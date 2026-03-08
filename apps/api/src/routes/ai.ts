import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import type { AuthEnv } from '../middleware/auth.js';
import { getUserId } from '../middleware/auth.js';
import { aiGateway, aiGatewayStream } from '../lib/ai-gateway.js';
import { enrichPerson, enrichOrganization, searchPeople } from '../lib/apollo.js';
import { getGmailClient, fetchSentEmails } from '../lib/gmail.js';

const ai = new Hono<AuthEnv>();

/** Strip markdown code fences (```json ... ```) from AI responses */
function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const composeSchema = z.object({
  contactId: z.string().uuid(),
  type: z.enum(['cold', 'warm', 'follow_up', 'intro_request']),
  goal: z.string().optional(),
  channel: z.enum(['email', 'sms']),
});

const classifySchema = z.object({
  body: z.string().min(1),
  subject: z.string().optional(),
});

const researchSchema = z.object({
  contactId: z.string().uuid().optional(),
  companyDomain: z.string().optional(),
  query: z.string().optional(),
});

const analyzeSchema = z.object({
  pipelineId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
});

// ─── POST /ai/compose ───────────────────────────────────────────────────────

ai.post('/compose', async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json();
  const parsed = composeSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { contactId, type, goal, channel } = parsed.data;

  try {
    const db = c.env.DB;

    // Fetch contact with company
    const contact = await db
      .prepare('SELECT * FROM contacts WHERE id = ? AND user_id = ?')
      .bind(contactId, userId)
      .first();

    if (!contact) {
      return c.json({ error: 'Contact not found' }, 404);
    }

    // Fetch company if linked
    let company: Record<string, unknown> | null = null;
    if (contact.company_id) {
      company = await db
        .prepare('SELECT * FROM companies WHERE id = ?')
        .bind(contact.company_id as string)
        .first();
    }

    // Fetch recent interactions
    const interactionsResult = await db
      .prepare(
        'SELECT * FROM interactions WHERE contact_id = ? AND user_id = ? ORDER BY occurred_at DESC LIMIT 10'
      )
      .bind(contactId, userId)
      .all();

    const interactions = interactionsResult.results;

    // Fetch user's style fingerprint + ICP
    const user = await db
      .prepare('SELECT style_fingerprint, mode, full_name, icp FROM users WHERE id = ?')
      .bind(userId)
      .first();

    const styleFingerprint = user?.style_fingerprint
      ? typeof user.style_fingerprint === 'string'
        ? JSON.parse(user.style_fingerprint as string)
        : user.style_fingerprint
      : null;
    const userMode = (user?.mode as string) ?? 'sales';

    // Build the compose prompt
    const interactionHistory = (interactions ?? [])
      .map((i) => `[${i.channel}/${i.direction}] ${i.occurred_at}: ${i.subject ?? ''} - ${((i.body_snippet as string) ?? '').substring(0, 300)}`)
      .join('\n');

    const companyContext = company
      ? `Company: ${company.name}, Industry: ${company.industry ?? 'Unknown'}, Size: ${company.size ?? 'Unknown'}`
      : '';

    const styleInstructions = styleFingerprint
      ? `Match this writing style:
- Greeting style: ${styleFingerprint.greeting_style}
- Sign-off: ${styleFingerprint.sign_off_style}
- Formality: ${styleFingerprint.tone_markers?.formality ?? 5}/10
- Warmth: ${styleFingerprint.tone_markers?.warmth ?? 5}/10
- Vocabulary: ${styleFingerprint.vocabulary_level}
- Paragraph style: ${styleFingerprint.paragraph_structure}`
      : 'Use a professional, conversational tone.';

    const icpContext = user?.icp ? `\nIdeal Customer Profile: ${user.icp}` : '';

    const systemPrompt = `You are Mercury's Composer Agent. You draft ${channel === 'email' ? 'emails' : 'text messages'} that sound exactly like the user.
${icpContext}

${styleInstructions}

Rules:
- Never be generic or salesy
- Reference specific details about the contact and their company
- Keep it concise and natural
- For SMS: keep under 160 characters when possible
- For cold outreach: find a genuine reason to reach out
- For follow-ups: reference the last interaction naturally`;

    const userPrompt = `Draft a ${type} ${channel === 'email' ? 'email' : 'text message'} to:
Name: ${contact.full_name}
Title: ${contact.title ?? 'Unknown'}
${companyContext}
Segment: ${contact.segment}
Outreach Path: ${contact.outreach_path ?? 'direct_inbox'}

${goal ? `Goal: ${goal}` : ''}

Recent interaction history:
${interactionHistory || 'No prior interactions.'}

User mode: ${userMode}

Respond with JSON: { "subject": "email subject line or null for SMS", "body": "the full message body" }`;

    // Check if client wants streaming
    const acceptHeader = c.req.header('Accept') ?? '';
    const wantsStream = acceptHeader.includes('text/event-stream');

    if (wantsStream) {
      return streamSSE(c, async (stream) => {
        const chunks: string[] = [];
        for await (const chunk of aiGatewayStream({
          model: 'sonnet',
          userId,
          agentType: 'composer',
          db,
          apiKey: c.env.ANTHROPIC_API_KEY,
          messages: [{ role: 'user', content: userPrompt }],
          system: systemPrompt,
        })) {
          chunks.push(chunk);
          await stream.writeSSE({ data: chunk, event: 'chunk' });
        }
        await stream.writeSSE({
          data: JSON.stringify({ done: true, full_content: chunks.join('') }),
          event: 'done',
        });
      });
    }

    // Non-streaming response
    const response = await aiGateway({
      model: 'sonnet',
      userId,
      agentType: 'composer',
      db,
      apiKey: c.env.ANTHROPIC_API_KEY,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    let draft: { subject: string | null; body: string };
    try {
      draft = JSON.parse(stripCodeFences(response.content));
    } catch {
      // If AI didn't return valid JSON, treat the whole response as the body
      draft = { subject: null, body: stripCodeFences(response.content) };
    }

    return c.json({
      subject: draft.subject,
      body: draft.body,
      model: response.model,
      tokens_used: response.tokensUsed,
      cost_cents: response.costCents,
    });
  } catch (error) {
    console.error('[ai/compose] Compose failed:', error);
    return c.json({ error: 'Failed to generate draft' }, 500);
  }
});

// ─── POST /ai/classify ─────────────────────────────────────────────────────

ai.post('/classify', async (c) => {
  const userId = getUserId(c);
  const reqBody = await c.req.json();
  const parsed = classifySchema.safeParse(reqBody);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { body: messageBody, subject } = parsed.data;

  try {
    const response = await aiGateway({
      model: 'haiku',
      userId,
      agentType: 'orchestrator',
      db: c.env.DB,
      apiKey: c.env.ANTHROPIC_API_KEY,
      messages: [
        {
          role: 'user',
          content: `Classify this incoming message and respond with JSON only:
${subject ? `Subject: ${subject}` : ''}
Body: ${messageBody.substring(0, 3000)}

Respond with JSON: {
  "intent": "interested|question|objection|not_now|referral|ooo",
  "sentiment": "positive|neutral|negative",
  "suggestedAction": "follow_up|reply_needed|warm_intro|meeting_prep|new_prospect|deal_cold|candidate_responded|log_notes|null"
}`,
        },
      ],
    });

    let classification: { intent: string; sentiment: string; suggestedAction: string | null };
    try {
      classification = JSON.parse(stripCodeFences(response.content));
    } catch {
      return c.json({ error: 'AI returned invalid classification format' }, 500);
    }

    return c.json({
      intent: classification.intent,
      sentiment: classification.sentiment,
      suggestedAction: classification.suggestedAction,
      model: response.model,
      tokens_used: response.tokensUsed,
    });
  } catch (error) {
    console.error('[ai/classify] Classification failed:', error);
    return c.json({ error: 'Classification failed' }, 500);
  }
});

// ─── POST /ai/research ─────────────────────────────────────────────────────

ai.post('/research', async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json();
  const parsed = researchSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { contactId, companyDomain, query } = parsed.data;

  if (!contactId && !companyDomain && !query) {
    return c.json({ error: 'At least one of contactId, companyDomain, or query is required' }, 400);
  }

  try {
    const db = c.env.DB;
    const researchData: Record<string, unknown> = {};

    // Research a specific contact
    if (contactId) {
      const contact = await db
        .prepare('SELECT * FROM contacts WHERE id = ? AND user_id = ?')
        .bind(contactId, userId)
        .first();

      if (contact) {
        // Fetch company if linked
        let company: Record<string, unknown> | null = null;
        if (contact.company_id) {
          company = await db
            .prepare('SELECT * FROM companies WHERE id = ?')
            .bind(contact.company_id as string)
            .first();
        }

        // Enrich via Apollo
        const enriched = await enrichPerson(c.env.APOLLO_API_KEY, {
          email: (contact.email as string) ?? undefined,
          first_name: (contact.first_name as string) ?? undefined,
          last_name: (contact.last_name as string) ?? undefined,
          linkedin_url: (contact.linkedin_url as string) ?? undefined,
        });

        researchData.contact = { ...contact, companies: company };
        researchData.enrichment = enriched;
      }
    }

    // Research a company by domain
    if (companyDomain) {
      const orgData = await enrichOrganization(c.env.APOLLO_API_KEY, { domain: companyDomain });
      researchData.company = orgData;

      // Find key people at the company
      const people = await searchPeople(c.env.APOLLO_API_KEY, {
        q_organization_domains: [companyDomain],
        person_seniorities: ['director', 'vp', 'c_suite', 'owner'],
        per_page: 10,
      });
      researchData.key_people = people.people;
    }

    // Generate an AI-powered research brief
    const response = await aiGateway({
      model: 'sonnet',
      userId,
      agentType: 'scout',
      db,
      apiKey: c.env.ANTHROPIC_API_KEY,
      messages: [
        {
          role: 'user',
          content: `Generate a structured research brief based on this data:
${JSON.stringify(researchData, null, 2)}
${query ? `\nAdditional research question: ${query}` : ''}

Respond with JSON: {
  "summary": "2-3 sentence executive summary",
  "key_findings": ["finding 1", "finding 2", ...],
  "talking_points": ["point 1", "point 2", ...],
  "potential_angles": ["approach 1", "approach 2", ...],
  "risk_factors": ["risk 1", ...],
  "recommended_next_step": "specific action recommendation"
}`,
        },
      ],
    });

    let brief: Record<string, unknown>;
    try {
      brief = JSON.parse(stripCodeFences(response.content));
    } catch {
      brief = { summary: response.content };
    }

    return c.json({
      brief,
      raw_data: researchData,
      model: response.model,
      tokens_used: response.tokensUsed,
      cost_cents: response.costCents,
    });
  } catch (error) {
    console.error('[ai/research] Research failed:', error);
    return c.json({ error: 'Research failed' }, 500);
  }
});

// ─── POST /ai/analyze ───────────────────────────────────────────────────────

ai.post('/analyze', async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json();
  const parsed = analyzeSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { pipelineId, contactId } = parsed.data;

  if (!pipelineId && !contactId) {
    return c.json({ error: 'Either pipelineId or contactId is required' }, 400);
  }

  try {
    const db = c.env.DB;
    const analysisData: Record<string, unknown> = {};

    if (pipelineId) {
      // Fetch pipeline
      const pipeline = await db
        .prepare('SELECT * FROM pipelines WHERE id = ? AND user_id = ?')
        .bind(pipelineId, userId)
        .first();

      // Fetch items with contacts
      const itemsResult = await db
        .prepare(
          `SELECT pi.*, c.full_name, c.title as contact_title, c.email as contact_email,
                  co.name as company_name
           FROM pipeline_items pi
           LEFT JOIN contacts c ON pi.contact_id = c.id
           LEFT JOIN companies co ON c.company_id = co.id
           WHERE pi.pipeline_id = ?`
        )
        .bind(pipelineId)
        .all();

      analysisData.pipeline = pipeline;
      analysisData.items = itemsResult.results;
    }

    if (contactId) {
      // Fetch contact with company
      const contact = await db
        .prepare('SELECT * FROM contacts WHERE id = ? AND user_id = ?')
        .bind(contactId, userId)
        .first();

      let company: Record<string, unknown> | null = null;
      if (contact?.company_id) {
        company = await db
          .prepare('SELECT * FROM companies WHERE id = ?')
          .bind(contact.company_id as string)
          .first();
      }

      const interactionsResult = await db
        .prepare(
          'SELECT * FROM interactions WHERE contact_id = ? AND user_id = ? ORDER BY occurred_at DESC LIMIT 20'
        )
        .bind(contactId, userId)
        .all();

      analysisData.contact = { ...contact, companies: company };
      analysisData.interactions = interactionsResult.results;
    }

    const response = await aiGateway({
      model: 'sonnet',
      userId,
      agentType: 'analyst',
      db,
      apiKey: c.env.ANTHROPIC_API_KEY,
      messages: [
        {
          role: 'user',
          content: `Analyze this ${pipelineId ? 'pipeline' : 'contact'} data and provide scoring and insights.

Data: ${JSON.stringify(analysisData, null, 2)}

Respond with JSON: {
  "scores": {
    "overall": 0-100,
    "engagement": 0-100,
    "momentum": 0-100,
    "fit": 0-100
  },
  "insights": ["insight 1", "insight 2", ...],
  "risks": ["risk 1", ...],
  "opportunities": ["opportunity 1", ...],
  "recommended_actions": [
    { "action": "description", "priority": "high|medium|low", "reason": "why" }
  ],
  "summary": "2-3 sentence summary"
}`,
        },
      ],
    });

    let analysis: Record<string, unknown>;
    try {
      analysis = JSON.parse(stripCodeFences(response.content));
    } catch {
      analysis = { summary: response.content };
    }

    return c.json({
      analysis,
      model: response.model,
      tokens_used: response.tokensUsed,
      cost_cents: response.costCents,
    });
  } catch (error) {
    console.error('[ai/analyze] Analysis failed:', error);
    return c.json({ error: 'Analysis failed' }, 500);
  }
});

// ─── POST /ai/analyze-style ─────────────────────────────────────────────────

ai.post('/analyze-style', async (c) => {
  const userId = getUserId(c);

  try {
    const db = c.env.DB;

    // Get linked Google account
    const linkedAccount = await db
      .prepare('SELECT * FROM linked_accounts WHERE user_id = ? AND provider = ?')
      .bind(userId, 'google')
      .first();

    if (!linkedAccount) {
      return c.json({ error: 'No Google account linked' }, 400);
    }

    const gmailClient = getGmailClient(
      c.env,
      linkedAccount.access_token as string,
      (linkedAccount.refresh_token as string) ?? undefined
    );

    // Fetch sent emails from last 90 days
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const sentEmails = await fetchSentEmails(gmailClient, since, 200);

    if (sentEmails.length < 5) {
      return c.json({ error: 'Not enough sent emails to analyze style (need at least 5)' }, 400);
    }

    // Extract body text from each email
    const emailBodies = sentEmails.map((e) => e.body).filter((b) => b && b.length > 20);

    const emailsText = emailBodies
      .slice(0, 200)
      .map((email, i) => `--- Email ${i + 1} ---\n${email}`)
      .join('\n\n');

    const userPrompt = `Analyze the following ${emailBodies.length} sent emails and extract a detailed writing style fingerprint.

Return a JSON object with EXACTLY these fields:

{
  "greeting_style": "The most common greeting pattern (e.g., 'Hey {name},' or 'Hi {name},')",
  "sign_off_style": "The most common sign-off (e.g., 'Best,' or 'Thanks,')",
  "avg_sentence_length": <number of words per sentence on average>,
  "vocabulary_level": "casual" | "professional" | "formal" | "academic",
  "emoji_usage": "never" | "rare" | "occasional" | "frequent",
  "punctuation_habits": {
    "uses_exclamations": <boolean>,
    "uses_ellipsis": <boolean>,
    "uses_dashes": <boolean>,
    "oxford_comma": <boolean>
  },
  "tone_markers": {
    "formality": <1-10>,
    "warmth": <1-10>,
    "humor": <1-10>,
    "directness": <1-10>,
    "confidence": <1-10>
  },
  "common_phrases": ["list of frequently used phrases or expressions"],
  "transition_words": ["list of commonly used transition words"],
  "paragraph_structure": "short" | "medium" | "long",
  "question_frequency": "never" | "rare" | "sometimes" | "often",
  "personal_anecdote_frequency": "never" | "rare" | "sometimes" | "often",
  "call_to_action_style": "Description of how they typically ask for action",
  "subject_line_style": "Description of their subject line patterns"
}

Focus on patterns that appear consistently across multiple emails, not one-off occurrences.

EMAILS TO ANALYZE:

${emailsText}`;

    const response = await aiGateway({
      model: 'sonnet',
      userId,
      agentType: 'composer',
      db,
      apiKey: c.env.ANTHROPIC_API_KEY,
      maxTokens: 4096,
      messages: [{ role: 'user', content: userPrompt }],
      system:
        'You are a linguistic analyst specializing in personal writing style analysis. ' +
        'Analyze the provided emails and extract a detailed style fingerprint. ' +
        'Return ONLY valid JSON matching the StyleFingerprint schema. No markdown, no explanation.',
    });

    let fingerprint: Record<string, unknown>;
    try {
      fingerprint = JSON.parse(stripCodeFences(response.content));
    } catch {
      return c.json({ error: 'AI returned invalid style fingerprint format' }, 500);
    }

    // Save to users table
    await db
      .prepare('UPDATE users SET style_fingerprint = ?, updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(fingerprint), new Date().toISOString(), userId)
      .run();

    return c.json({
      fingerprint,
      emails_analyzed: emailBodies.length,
      model: response.model,
      tokens_used: response.tokensUsed,
    });
  } catch (error) {
    console.error('[ai/analyze-style] Style analysis failed:', error);
    return c.json({ error: 'Style analysis failed' }, 500);
  }
});

// ─── POST /ai/update-style ─────────────────────────────────────────────────

const updateStyleSchema = z.object({
  originalDraft: z.string().min(1),
  editedVersion: z.string().min(1),
});

ai.post('/update-style', async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json();
  const parsed = updateStyleSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { originalDraft, editedVersion } = parsed.data;

  try {
    const db = c.env.DB;

    // Read current fingerprint
    const user = await db
      .prepare('SELECT style_fingerprint FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user?.style_fingerprint) {
      return c.json({ error: 'No style fingerprint found. Run analyze-style first.' }, 400);
    }

    const current = typeof user.style_fingerprint === 'string'
      ? JSON.parse(user.style_fingerprint as string)
      : user.style_fingerprint;

    // Deterministic fingerprint update (ported from ToneEngine.updateFingerprint)
    const updated = structuredClone(current);

    // Analyze structural changes
    const originalSentences = originalDraft.split(/[.!?]+/).filter(Boolean);
    const editedSentences = editedVersion.split(/[.!?]+/).filter(Boolean);

    // Update average sentence length
    const editedAvgLength =
      editedSentences.reduce((sum: number, s: string) => sum + s.trim().split(/\s+/).length, 0) /
      Math.max(editedSentences.length, 1);
    updated.avg_sentence_length = Math.round(
      ((current.avg_sentence_length ?? 15) * 0.8 + editedAvgLength * 0.2) * 10,
    ) / 10;

    // Detect greeting changes
    const editedFirstLine = editedVersion.split('\n')[0]?.trim() ?? '';
    if (editedFirstLine !== originalDraft.split('\n')[0]?.trim()) {
      updated.greeting_style = editedFirstLine;
    }

    // Detect sign-off changes
    const editedLines = editedVersion.trim().split('\n');
    const editedLastLine = editedLines[editedLines.length - 1]?.trim() ?? '';
    const originalLines = originalDraft.trim().split('\n');
    const originalLastLine = originalLines[originalLines.length - 1]?.trim() ?? '';
    if (editedLastLine !== originalLastLine) {
      updated.sign_off_style = editedLastLine;
    }

    // Detect emoji usage changes
    const originalEmojis = (originalDraft.match(/[\p{Emoji_Presentation}]/gu) ?? []).length;
    const editedEmojis = (editedVersion.match(/[\p{Emoji_Presentation}]/gu) ?? []).length;
    const emojiLevels = ['never', 'rare', 'occasional', 'frequent'];
    if (editedEmojis > originalEmojis) {
      const currentIndex = emojiLevels.indexOf(current.emoji_usage ?? 'never');
      if (currentIndex < emojiLevels.length - 1) {
        updated.emoji_usage = emojiLevels[currentIndex + 1];
      }
    } else if (editedEmojis < originalEmojis && editedEmojis === 0) {
      const currentIndex = emojiLevels.indexOf(current.emoji_usage ?? 'never');
      if (currentIndex > 0) {
        updated.emoji_usage = emojiLevels[currentIndex - 1];
      }
    }

    // Detect punctuation changes
    updated.punctuation_habits = {
      ...(current.punctuation_habits ?? {}),
      uses_exclamations: /!/.test(editedVersion),
      uses_ellipsis: /\.{3}|…/.test(editedVersion),
      uses_dashes: /[—–-]{2,}|—/.test(editedVersion),
    };

    // Detect formality shift
    const casualIndicators = /\b(hey|yeah|gonna|wanna|kinda|btw|fyi|lol)\b/gi;
    const formalIndicators = /\b(regarding|pursuant|accordingly|furthermore|hereby)\b/gi;
    const editedCasual = (editedVersion.match(casualIndicators) ?? []).length;
    const editedFormal = (editedVersion.match(formalIndicators) ?? []).length;
    const originalCasual = (originalDraft.match(casualIndicators) ?? []).length;
    const originalFormal = (originalDraft.match(formalIndicators) ?? []).length;

    if (!updated.tone_markers) updated.tone_markers = {};
    if (editedCasual > originalCasual) {
      updated.tone_markers.formality = Math.max(1, (current.tone_markers?.formality ?? 5) - 0.5);
    } else if (editedFormal > originalFormal) {
      updated.tone_markers.formality = Math.min(10, (current.tone_markers?.formality ?? 5) + 0.5);
    }

    // Detect paragraph structure changes
    const editedParagraphs = editedVersion.split(/\n\s*\n/).filter(Boolean);
    const avgParagraphLength =
      editedParagraphs.reduce((sum: number, p: string) => sum + p.split(/\s+/).length, 0) /
      Math.max(editedParagraphs.length, 1);
    if (avgParagraphLength < 30) {
      updated.paragraph_structure = 'short';
    } else if (avgParagraphLength < 60) {
      updated.paragraph_structure = 'medium';
    } else {
      updated.paragraph_structure = 'long';
    }

    // Shorter edits suggest preference for directness
    if (editedVersion.length < originalDraft.length * 0.8) {
      updated.tone_markers.directness = Math.min(10, (current.tone_markers?.directness ?? 5) + 0.5);
    } else if (editedVersion.length > originalDraft.length * 1.2) {
      updated.tone_markers.directness = Math.max(1, (current.tone_markers?.directness ?? 5) - 0.3);
    }

    // Save updated fingerprint
    await db
      .prepare('UPDATE users SET style_fingerprint = ?, updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(updated), new Date().toISOString(), userId)
      .run();

    // Log the style edit for future analysis
    await db
      .prepare(
        `INSERT INTO style_edits (id, user_id, original_text, edited_text, edit_type, context, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        userId,
        originalDraft.substring(0, 5000),
        editedVersion.substring(0, 5000),
        'tone',
        JSON.stringify({ source: 'ai_draft_edit' }),
        new Date().toISOString()
      )
      .run();

    return c.json({ fingerprint: updated });
  } catch (error) {
    console.error('[ai/update-style] Style update failed:', error);
    return c.json({ error: 'Style update failed' }, 500);
  }
});

export default ai;
