import type { StyleFingerprint, ComposeContext } from '@mercury/shared';

/**
 * Prompt for analyzing a user's writing style from their sent emails.
 */
export function styleAnalysisPrompt(emails: string[]): string {
  const emailsText = emails
    .map((email, i) => `--- Email ${i + 1} ---\n${email}`)
    .join('\n\n');

  return `Analyze the following ${emails.length} sent emails and extract a detailed writing style fingerprint.

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
}

/**
 * Prompt for composing an email that matches the user's style.
 * This is the core prompt that powers Mercury's tone matching.
 */
export function emailCompositionPrompt(
  fingerprint: StyleFingerprint,
  context: ComposeContext,
): string {
  const recentInteractionSummary = context.recent_interactions
    .slice(0, 5)
    .map(
      (i) =>
        `- [${i.type}] ${i.subject ?? '(no subject)'}: ${(i.body ?? '').slice(0, 100)}...`,
    )
    .join('\n');

  return `You are composing an email on behalf of a user. Your goal is to write something indistinguishable from what they would write themselves.

## STYLE FINGERPRINT (match this exactly)

Greeting: ${fingerprint.greeting_style}
Sign-off: ${fingerprint.sign_off_style}
Sentence length: ~${fingerprint.avg_sentence_length} words average
Vocabulary: ${fingerprint.vocabulary_level}
Emoji usage: ${fingerprint.emoji_usage}
Exclamation marks: ${fingerprint.punctuation_habits.uses_exclamations ? 'yes' : 'no'}
Ellipsis: ${fingerprint.punctuation_habits.uses_ellipsis ? 'yes' : 'no'}
Dashes: ${fingerprint.punctuation_habits.uses_dashes ? 'yes' : 'no'}
Oxford comma: ${fingerprint.punctuation_habits.oxford_comma ? 'yes' : 'no'}

Tone: formality=${fingerprint.tone_markers.formality}/10, warmth=${fingerprint.tone_markers.warmth}/10, humor=${fingerprint.tone_markers.humor}/10, directness=${fingerprint.tone_markers.directness}/10, confidence=${fingerprint.tone_markers.confidence}/10

Commonly used phrases: ${fingerprint.common_phrases.join(', ')}
Transition words: ${fingerprint.transition_words.join(', ')}
Paragraph style: ${fingerprint.paragraph_structure}
Question frequency: ${fingerprint.question_frequency}
CTA style: ${fingerprint.call_to_action_style}

## CONTEXT

Recipient: ${context.contact.full_name}${context.contact.title ? ` (${context.contact.title})` : ''}
Company: ${context.company?.name ?? 'Unknown'}
Outreach path: ${context.outreach_path}
Intent: ${context.intent}
Mode: ${context.user_mode}
${context.additional_context ? `Additional context: ${context.additional_context}` : ''}

## RECENT INTERACTION HISTORY

${recentInteractionSummary || 'No prior interactions.'}

## INSTRUCTIONS

1. Write the email body only (no subject line unless this is a first outreach).
2. Match the style fingerprint precisely - this should read as if the user wrote it.
3. Keep it natural and human. Never sound like AI.
4. Reference relevant context from recent interactions where appropriate.
5. End with a clear but natural call-to-action matching their CTA style.
6. For ${context.outreach_path === 'cold_enriched' || context.outreach_path === 'cold_research' ? 'cold outreach' : 'warm communication'}, ${context.outreach_path === 'cold_enriched' || context.outreach_path === 'cold_research' ? 'keep it brief and find a genuine connection point' : 'build on the existing relationship'}.

Return ONLY the email text. No explanations, no markdown formatting.`;
}

/**
 * Prompt for classifying incoming messages by intent, sentiment, and urgency.
 */
export function messageClassificationPrompt(
  messageBody: string,
  messageSubject: string | null,
  senderName: string | null,
  threadContext: string | null,
): string {
  return `Classify this incoming message. Return ONLY valid JSON.

${messageSubject ? `Subject: ${messageSubject}` : ''}
${senderName ? `From: ${senderName}` : ''}
${threadContext ? `Thread context: ${threadContext}` : ''}

Message:
${messageBody}

Return JSON with these fields:
{
  "intent": "interested" | "question" | "objection" | "not_now" | "referral" | "ooo",
  "confidence": <0-1>,
  "sentiment": "positive" | "neutral" | "negative",
  "urgency": "immediate" | "today" | "this_week" | "no_rush",
  "suggested_action": "follow_up" | "reply_needed" | "warm_intro" | "meeting_prep" | "new_prospect" | "deal_cold" | "candidate_responded" | "log_notes" | null,
  "key_phrases": ["list of important phrases from the message"],
  "summary": "One sentence summary of the message"
}`;
}

/**
 * Prompt for generating meeting preparation briefings.
 */
export function meetingPrepPrompt(
  contactName: string,
  contactTitle: string | null,
  companyName: string | null,
  companyDescription: string | null,
  recentInteractions: string[],
  meetingTopic: string | null,
): string {
  const interactionsText = recentInteractions
    .map((i, idx) => `${idx + 1}. ${i}`)
    .join('\n');

  return `Prepare a concise meeting briefing for an upcoming meeting.

## MEETING DETAILS
Contact: ${contactName}${contactTitle ? ` - ${contactTitle}` : ''}
Company: ${companyName ?? 'Unknown'}
${companyDescription ? `About: ${companyDescription}` : ''}
${meetingTopic ? `Topic: ${meetingTopic}` : ''}

## RECENT INTERACTION HISTORY
${interactionsText || 'No prior interactions recorded.'}

## GENERATE

Create a briefing with these sections:
1. **Key Context** - What you need to know going in (2-3 bullets)
2. **Relationship Status** - Where things stand based on history
3. **Talking Points** - 3-4 suggested topics or questions
4. **Watch For** - Any risks or sensitivities to be aware of
5. **Goal** - Suggested primary objective for this meeting

Keep it concise and actionable. No fluff.`;
}

/**
 * Prompt for scoring deals in a sales pipeline.
 */
export function dealScoringPrompt(
  contactName: string,
  companyName: string | null,
  stage: string,
  value: number | null,
  daysSinceLastActivity: number,
  interactionCount: number,
  sentiment: string,
  notes: string | null,
): string {
  return `Score this deal and provide a health assessment. Return ONLY valid JSON.

## DEAL DETAILS
Contact: ${contactName}
Company: ${companyName ?? 'Unknown'}
Stage: ${stage}
Value: ${value ? `$${value.toLocaleString()}` : 'Not specified'}
Days since last activity: ${daysSinceLastActivity}
Total interactions: ${interactionCount}
Last sentiment: ${sentiment}
${notes ? `Notes: ${notes}` : ''}

Return JSON:
{
  "score": <0-100>,
  "health": "strong" | "healthy" | "at_risk" | "stalled" | "cold",
  "risk_factors": ["list of concerns"],
  "recommended_actions": ["list of next steps"],
  "win_probability": <0-1>,
  "estimated_days_to_close": <number or null>,
  "summary": "One sentence deal assessment"
}`;
}

/**
 * Prompt for scoring candidates in a recruiting pipeline.
 */
export function candidateScoringPrompt(
  candidateName: string,
  candidateTitle: string | null,
  currentCompany: string | null,
  stage: string,
  daysSinceLastActivity: number,
  interactionCount: number,
  sentiment: string,
  notes: string | null,
): string {
  return `Score this recruiting candidate and provide a status assessment. Return ONLY valid JSON.

## CANDIDATE DETAILS
Name: ${candidateName}
Current title: ${candidateTitle ?? 'Unknown'}
Current company: ${currentCompany ?? 'Unknown'}
Pipeline stage: ${stage}
Days since last activity: ${daysSinceLastActivity}
Total interactions: ${interactionCount}
Last sentiment: ${sentiment}
${notes ? `Notes: ${notes}` : ''}

Return JSON:
{
  "score": <0-100>,
  "engagement_level": "highly_engaged" | "engaged" | "lukewarm" | "disengaged" | "ghosted",
  "risk_factors": ["list of concerns"],
  "recommended_actions": ["list of next steps"],
  "response_likelihood": <0-1>,
  "estimated_days_to_decision": <number or null>,
  "summary": "One sentence candidate assessment"
}`;
}
