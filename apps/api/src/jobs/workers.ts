import { Worker, type Job } from 'bullmq';
import {
  getConnectionOptions,
  QUEUE_NAMES,
  type EmailSyncJobData,
  type EnrichmentJobData,
  type FollowUpScannerJobData,
  type DealScoringJobData,
  type MeetingPrepJobData,
} from './index.js';
import { getServiceClient } from '../lib/supabase.js';
import { getGmailClient, fetchNewEmails, fetchSentEmails } from '../lib/gmail.js';
import { getCalendarClient, fetchEvents } from '../lib/calendar.js';
import { enrichPerson } from '../lib/apollo.js';
import { aiGateway } from '../lib/ai-gateway.js';

// ─── Email Sync Worker ──────────────────────────────────────────────────────

async function processEmailSync(job: Job<EmailSyncJobData>): Promise<void> {
  const { userId, fullHistory, since } = job.data;
  const supabase = getServiceClient();

  console.log(`[emailSyncWorker] Processing email sync for user ${userId}`);

  // Fetch linked Google account
  const { data: linkedAccount } = await supabase
    .from('linked_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .eq('is_active', true)
    .maybeSingle();

  if (!linkedAccount) {
    console.log(`[emailSyncWorker] No linked Google account for user ${userId}`);
    return;
  }

  const gmailClient = getGmailClient(
    linkedAccount.access_token,
    linkedAccount.refresh_token ?? undefined
  );

  const sinceDate = since
    ? new Date(since)
    : fullHistory
      ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days
      : new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours

  const maxResults = fullHistory ? 200 : 50;

  const [newEmails, sentEmails] = await Promise.all([
    fetchNewEmails(gmailClient, sinceDate, maxResults),
    fetchSentEmails(gmailClient, sinceDate, maxResults),
  ]);

  // Process incoming emails
  for (const email of newEmails) {
    // Find contact
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId)
      .eq('email', email.from)
      .maybeSingle();

    // Create contact if new and we have enough info
    let contactId = contact?.id ?? null;

    if (!contactId && email.fromName) {
      const nameParts = email.fromName.split(' ');
      const { data: newContact } = await supabase
        .from('contacts')
        .insert({
          user_id: userId,
          full_name: email.fromName,
          first_name: nameParts[0] ?? null,
          last_name: nameParts.slice(1).join(' ') || null,
          email: email.from,
          segment: 'connected',
          relationship_score: 30,
          tags: ['auto_imported'],
        })
        .select('id')
        .single();

      contactId = newContact?.id ?? null;
    }

    // Insert interaction (deduplicate by gmail_id)
    await supabase.from('interactions').upsert(
      {
        user_id: userId,
        contact_id: contactId,
        type: 'email_received',
        subject: email.subject,
        body: email.body.substring(0, 5000),
        channel: 'email',
        metadata: {
          gmail_id: email.id,
          thread_id: email.threadId,
          from: email.from,
          from_name: email.fromName,
        },
        occurred_at: email.date.toISOString(),
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );
  }

  // Process sent emails
  for (const email of sentEmails) {
    for (const recipient of email.to) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', userId)
        .eq('email', recipient)
        .maybeSingle();

      if (contact) {
        await supabase.from('interactions').upsert(
          {
            user_id: userId,
            contact_id: contact.id,
            type: 'email_sent',
            subject: email.subject,
            body: email.body.substring(0, 5000),
            channel: 'email',
            metadata: {
              gmail_id: email.id,
              thread_id: email.threadId,
            },
            occurred_at: email.date.toISOString(),
          },
          { onConflict: 'id', ignoreDuplicates: true }
        );

        await supabase
          .from('contacts')
          .update({ last_interaction_at: email.date.toISOString() })
          .eq('id', contact.id);
      }
    }
  }

  console.log(
    `[emailSyncWorker] Synced ${newEmails.length} incoming + ${sentEmails.length} sent emails for user ${userId}`
  );
}

// ─── Enrichment Worker ──────────────────────────────────────────────────────

async function processEnrichment(job: Job<EnrichmentJobData>): Promise<void> {
  const { userId, contactIds, source } = job.data;
  const supabase = getServiceClient();

  console.log(`[enrichmentWorker] Processing enrichment for user ${userId}, source: ${source}`);

  let contacts;

  if (contactIds?.length) {
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .in('id', contactIds);
    contacts = data;
  } else {
    // Enrich contacts that haven't been enriched yet
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .is('enrichment_data', null)
      .limit(50);
    contacts = data;
  }

  if (!contacts || contacts.length === 0) {
    console.log(`[enrichmentWorker] No contacts to enrich for user ${userId}`);
    return;
  }

  let enrichedCount = 0;

  for (const contact of contacts) {
    try {
      const enriched = await enrichPerson({
        email: contact.email ?? undefined,
        first_name: contact.first_name ?? undefined,
        last_name: contact.last_name ?? undefined,
        linkedin_url: contact.linkedin_url ?? undefined,
      });

      if (enriched) {
        await supabase
          .from('contacts')
          .update({
            title: enriched.title || contact.title,
            linkedin_url: enriched.linkedin_url || contact.linkedin_url,
            avatar_url: enriched.photo_url || contact.avatar_url,
            enrichment_data: enriched as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          })
          .eq('id', contact.id);

        enrichedCount++;
      }

      // Rate limit between enrichments
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error(`[enrichmentWorker] Failed to enrich contact ${contact.id}:`, error);
    }
  }

  console.log(
    `[enrichmentWorker] Enriched ${enrichedCount}/${contacts.length} contacts for user ${userId}`
  );
}

// ─── Follow-Up Scanner Worker ───────────────────────────────────────────────

async function processFollowUpScan(job: Job<FollowUpScannerJobData>): Promise<void> {
  const { userId } = job.data;
  const supabase = getServiceClient();

  console.log(`[followUpScannerWorker] Scanning follow-ups for user ${userId}`);

  // Find contacts where last interaction was more than 7 days ago
  // and they're in an active segment
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: overdueContacts } = await supabase
    .from('contacts')
    .select('id, full_name, email, title, segment, last_interaction_at, company_id, companies(name)')
    .eq('user_id', userId)
    .lt('last_interaction_at', sevenDaysAgo)
    .in('segment', ['hot_lead', 'warm', 'needs_followup'])
    .order('relationship_score', { ascending: false })
    .limit(20);

  if (!overdueContacts || overdueContacts.length === 0) {
    console.log(`[followUpScannerWorker] No overdue follow-ups for user ${userId}`);
    return;
  }

  let actionsCreated = 0;

  for (const contact of overdueContacts) {
    // Check if there's already a pending follow-up action for this contact
    const { data: existingAction } = await supabase
      .from('actions')
      .select('id')
      .eq('user_id', userId)
      .eq('contact_id', contact.id)
      .eq('type', 'follow_up')
      .eq('status', 'pending')
      .maybeSingle();

    if (existingAction) continue; // Skip if action already exists

    const daysSinceContact = contact.last_interaction_at
      ? Math.floor(
          (Date.now() - new Date(contact.last_interaction_at).getTime()) / (24 * 60 * 60 * 1000)
        )
      : null;

    const priority =
      contact.segment === 'hot_lead'
        ? 'urgent'
        : contact.segment === 'warm'
          ? 'high'
          : 'medium';

    await supabase.from('actions').insert({
      user_id: userId,
      contact_id: contact.id,
      type: 'follow_up',
      title: `Follow up with ${contact.full_name}`,
      description: daysSinceContact
        ? `No contact in ${daysSinceContact} days. ${contact.companies ? `Works at ${(contact.companies as unknown as { name: string }).name}.` : ''}`
        : `Overdue follow-up needed.`,
      priority,
      status: 'pending',
      agent_type: 'cadence',
      metadata: {
        days_since_contact: daysSinceContact,
        segment: contact.segment,
      },
    });

    actionsCreated++;
  }

  console.log(
    `[followUpScannerWorker] Created ${actionsCreated} follow-up actions for user ${userId}`
  );
}

// ─── Deal Scoring Worker ────────────────────────────────────────────────────

async function processDealScoring(job: Job<DealScoringJobData>): Promise<void> {
  const { userId, pipelineId } = job.data;
  const supabase = getServiceClient();

  console.log(`[dealScoringWorker] Scoring deals for user ${userId}`);

  let query = supabase
    .from('pipeline_items')
    .select('*, contacts(*, companies(*)), pipelines!inner(user_id, type)')
    .eq('pipelines.user_id', userId);

  if (pipelineId) {
    query = query.eq('pipeline_id', pipelineId);
  }

  const { data: items } = await query;

  if (!items || items.length === 0) {
    console.log(`[dealScoringWorker] No pipeline items to score for user ${userId}`);
    return;
  }

  // Batch score items using AI
  const itemSummaries = items.map((item) => ({
    id: item.id,
    stage: item.stage,
    contact_name: (item.contacts as { full_name: string })?.full_name,
    company: (item.contacts as { companies: { name: string } | null })?.companies?.name,
    value: item.value,
    days_in_stage: Math.floor(
      (Date.now() - new Date(item.updated_at).getTime()) / (24 * 60 * 60 * 1000)
    ),
  }));

  try {
    const response = await aiGateway({
      model: 'haiku',
      userId,
      agentType: 'analyst',
      messages: [
        {
          role: 'user',
          content: `Score these pipeline items on a 0-100 scale based on stage progression and time. Return JSON array:

Items: ${JSON.stringify(itemSummaries)}

Return: [{ "id": "item_id", "score": number, "risk": "low|medium|high" }]`,
        },
      ],
    });

    let scores: Array<{ id: string; score: number; risk: string }>;
    try {
      scores = JSON.parse(response.content);
    } catch {
      console.error('[dealScoringWorker] Failed to parse AI scores');
      return;
    }

    for (const scoreItem of scores) {
      await supabase
        .from('pipeline_items')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', scoreItem.id);

      // Create action for high-risk items
      if (scoreItem.risk === 'high') {
        const item = items.find((i) => i.id === scoreItem.id);
        if (item) {
          await supabase.from('actions').insert({
            user_id: userId,
            contact_id: (item.contacts as { id: string })?.id ?? null,
            type: 'deal_cold',
            title: `Deal at risk: ${(item.contacts as { full_name: string })?.full_name ?? 'Unknown'}`,
            description: `Score: ${scoreItem.score}/100. Currently in "${item.stage}" stage.`,
            priority: 'high',
            status: 'pending',
            agent_type: 'analyst',
            metadata: {
              pipeline_item_id: item.id,
              score: scoreItem.score,
              risk: scoreItem.risk,
            },
          });
        }
      }
    }

    console.log(`[dealScoringWorker] Scored ${scores.length} items for user ${userId}`);
  } catch (error) {
    console.error('[dealScoringWorker] AI scoring failed:', error);
  }
}

// ─── Meeting Prep Worker ────────────────────────────────────────────────────

async function processMeetingPrep(job: Job<MeetingPrepJobData>): Promise<void> {
  const { userId, eventId } = job.data;
  const supabase = getServiceClient();

  console.log(`[meetingPrepWorker] Preparing meeting briefings for user ${userId}`);

  // Fetch linked Google account
  const { data: linkedAccount } = await supabase
    .from('linked_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .eq('is_active', true)
    .maybeSingle();

  if (!linkedAccount) return;

  const calendarClient = getCalendarClient(
    linkedAccount.access_token,
    linkedAccount.refresh_token ?? undefined
  );

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const events = await fetchEvents(calendarClient, now, tomorrow);

  for (const event of events) {
    // Skip if specific eventId given and this isn't it
    if (eventId && event.id !== eventId) continue;

    // Skip events without external attendees
    const externalAttendees = event.attendees.filter((a) => !a.self);
    if (externalAttendees.length === 0) continue;

    // Find matching contacts
    const { data: matchedContacts } = await supabase
      .from('contacts')
      .select('*, companies(*)')
      .eq('user_id', userId)
      .in(
        'email',
        externalAttendees.map((a) => a.email)
      );

    if (!matchedContacts || matchedContacts.length === 0) continue;

    // Fetch recent interactions with matched contacts
    const contactIds = matchedContacts.map((c) => c.id);
    const { data: recentInteractions } = await supabase
      .from('interactions')
      .select('*')
      .eq('user_id', userId)
      .in('contact_id', contactIds)
      .order('occurred_at', { ascending: false })
      .limit(10);

    // Generate meeting briefing
    try {
      const response = await aiGateway({
        model: 'haiku',
        userId,
        agentType: 'orchestrator',
        messages: [
          {
            role: 'user',
            content: `Generate a brief meeting prep summary:

Meeting: ${event.summary}
Time: ${event.start.toISOString()}
Attendees: ${matchedContacts.map((c) => `${c.full_name} (${c.title ?? 'Unknown'} at ${c.companies?.name ?? 'Unknown'})`).join(', ')}

Recent interactions:
${(recentInteractions ?? []).map((i) => `[${i.type}] ${i.occurred_at}: ${i.subject ?? ''}`).join('\n')}

Respond with JSON: { "summary": "2-3 sentences", "key_points": ["point 1", ...], "talking_points": ["point 1", ...] }`,
          },
        ],
      });

      let briefing: Record<string, unknown>;
      try {
        briefing = JSON.parse(response.content);
      } catch {
        briefing = { summary: response.content };
      }

      // Create meeting prep action
      await supabase.from('actions').insert({
        user_id: userId,
        contact_id: matchedContacts[0].id,
        type: 'meeting_prep',
        title: `Meeting prep: ${event.summary}`,
        description: (briefing.summary as string) ?? `Meeting at ${event.start.toLocaleTimeString()}`,
        priority: 'high',
        status: 'pending',
        agent_type: 'orchestrator',
        due_at: new Date(event.start.getTime() - 30 * 60 * 1000).toISOString(),
        metadata: {
          event_id: event.id,
          event_summary: event.summary,
          briefing,
          attendees: matchedContacts.map((c) => ({
            id: c.id,
            name: c.full_name,
          })),
        },
      });
    } catch (error) {
      console.error(`[meetingPrepWorker] Failed to generate briefing for event ${event.id}:`, error);
    }
  }

  console.log(`[meetingPrepWorker] Completed meeting prep for user ${userId}`);
}

// ─── Worker Initialization ──────────────────────────────────────────────────

export function startWorkers(): void {
  const connection = getConnectionOptions();

  const emailSyncWorker = new Worker(
    QUEUE_NAMES.EMAIL_SYNC,
    async (job) => processEmailSync(job),
    { connection, concurrency: 3 }
  );

  const enrichmentWorker = new Worker(
    QUEUE_NAMES.ENRICHMENT,
    async (job) => processEnrichment(job),
    { connection, concurrency: 2 }
  );

  const followUpScannerWorker = new Worker(
    QUEUE_NAMES.FOLLOW_UP_SCANNER,
    async (job) => processFollowUpScan(job),
    { connection, concurrency: 1 }
  );

  const dealScoringWorker = new Worker(
    QUEUE_NAMES.DEAL_SCORING,
    async (job) => processDealScoring(job),
    { connection, concurrency: 1 }
  );

  const meetingPrepWorker = new Worker(
    QUEUE_NAMES.MEETING_PREP,
    async (job) => processMeetingPrep(job),
    { connection, concurrency: 2 }
  );

  // Error handlers
  const workers = [
    emailSyncWorker,
    enrichmentWorker,
    followUpScannerWorker,
    dealScoringWorker,
    meetingPrepWorker,
  ];

  for (const worker of workers) {
    worker.on('completed', (job) => {
      console.log(`[${worker.name}] Job ${job.id} completed`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[${worker.name}] Job ${job?.id} failed:`, err.message);
    });

    worker.on('error', (err) => {
      console.error(`[${worker.name}] Worker error:`, err);
    });
  }

  console.log('[workers] All BullMQ workers started');
}
