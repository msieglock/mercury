import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import type { AuthEnv } from '../middleware/auth.js';
import { getUserId } from '../middleware/auth.js';
import { getServiceClient } from '../lib/supabase.js';
import { aiGateway, aiGatewayStream } from '../lib/ai-gateway.js';
import { enrichPerson, enrichOrganization, searchPeople } from '../lib/apollo.js';

const ai = new Hono<AuthEnv>();

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
    const supabase = getServiceClient();

    // Fetch contact with company
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*, companies(*)')
      .eq('id', contactId)
      .eq('user_id', userId)
      .single();

    if (contactError || !contact) {
      return c.json({ error: 'Contact not found' }, 404);
    }

    // Fetch recent interactions
    const { data: interactions } = await supabase
      .from('interactions')
      .select('*')
      .eq('contact_id', contactId)
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(10);

    // Fetch user's style fingerprint
    const { data: user } = await supabase
      .from('users')
      .select('style_fingerprint, mode, full_name')
      .eq('id', userId)
      .single();

    const styleFingerprint = user?.style_fingerprint;
    const userMode = user?.mode ?? 'sales';

    // Build the compose prompt
    const interactionHistory = (interactions ?? [])
      .map((i) => `[${i.type}] ${i.occurred_at}: ${i.subject ?? ''} - ${(i.body ?? '').substring(0, 300)}`)
      .join('\n');

    const companyContext = contact.companies
      ? `Company: ${contact.companies.name}, Industry: ${contact.companies.industry ?? 'Unknown'}, Size: ${contact.companies.size ?? 'Unknown'}`
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

    const systemPrompt = `You are Mercury's Composer Agent. You draft ${channel === 'email' ? 'emails' : 'text messages'} that sound exactly like the user.

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
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    let draft: { subject: string | null; body: string };
    try {
      draft = JSON.parse(response.content);
    } catch {
      // If AI didn't return valid JSON, treat the whole response as the body
      draft = { subject: null, body: response.content };
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
      classification = JSON.parse(response.content);
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
    const supabase = getServiceClient();
    const researchData: Record<string, unknown> = {};

    // Research a specific contact
    if (contactId) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('*, companies(*)')
        .eq('id', contactId)
        .eq('user_id', userId)
        .single();

      if (contact) {
        // Enrich via Apollo
        const enriched = await enrichPerson({
          email: contact.email ?? undefined,
          first_name: contact.first_name ?? undefined,
          last_name: contact.last_name ?? undefined,
          linkedin_url: contact.linkedin_url ?? undefined,
        });

        researchData.contact = contact;
        researchData.enrichment = enriched;
      }
    }

    // Research a company by domain
    if (companyDomain) {
      const orgData = await enrichOrganization({ domain: companyDomain });
      researchData.company = orgData;

      // Find key people at the company
      const people = await searchPeople({
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
      brief = JSON.parse(response.content);
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
    const supabase = getServiceClient();
    const analysisData: Record<string, unknown> = {};

    if (pipelineId) {
      // Fetch pipeline with items and contacts
      const { data: pipeline } = await supabase
        .from('pipelines')
        .select('*')
        .eq('id', pipelineId)
        .eq('user_id', userId)
        .single();

      const { data: items } = await supabase
        .from('pipeline_items')
        .select('*, contacts(*)')
        .eq('pipeline_id', pipelineId);

      analysisData.pipeline = pipeline;
      analysisData.items = items;
    }

    if (contactId) {
      // Fetch contact with interactions
      const { data: contact } = await supabase
        .from('contacts')
        .select('*, companies(*)')
        .eq('id', contactId)
        .eq('user_id', userId)
        .single();

      const { data: interactions } = await supabase
        .from('interactions')
        .select('*')
        .eq('contact_id', contactId)
        .eq('user_id', userId)
        .order('occurred_at', { ascending: false })
        .limit(20);

      analysisData.contact = contact;
      analysisData.interactions = interactions;
    }

    const response = await aiGateway({
      model: 'sonnet',
      userId,
      agentType: 'analyst',
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
      analysis = JSON.parse(response.content);
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

export default ai;
