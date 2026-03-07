import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../middleware/auth.js';
import { getUserId } from '../middleware/auth.js';
import { getGmailClient, fetchNewEmails, fetchSentEmails } from '../lib/gmail.js';
import { getCalendarClient, fetchEvents } from '../lib/calendar.js';
import { enrichPerson } from '../lib/apollo.js';
import { aiGateway } from '../lib/ai-gateway.js';

const sync = new Hono<AuthEnv>();

// ─── Schemas ────────────────────────────────────────────────────────────────

const emailSyncSchema = z.object({
  since: z.string().datetime().optional(),
  max_results: z.number().int().min(1).max(200).optional(),
});

const calendarSyncSchema = z.object({
  time_min: z.string().datetime().optional(),
  time_max: z.string().datetime().optional(),
});

const contactEnrichSchema = z.object({
  contact_ids: z.array(z.string().uuid()).min(1).max(50),
});

// ─── POST /sync/email ───────────────────────────────────────────────────────

sync.post('/email', async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = emailSyncSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  try {
    const db = c.env.DB;

    // Fetch user's Google linked account
    const linkedAccount = await db
      .prepare(
        'SELECT * FROM linked_accounts WHERE user_id = ? AND provider = ? AND is_active = 1'
      )
      .bind(userId, 'google')
      .first();

    if (!linkedAccount) {
      return c.json({ error: 'No active Google account linked' }, 400);
    }

    const gmailClient = getGmailClient(
      c.env,
      linkedAccount.access_token as string,
      (linkedAccount.refresh_token as string) ?? undefined
    );

    const since = parsed.data.since
      ? new Date(parsed.data.since)
      : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours

    const maxResults = parsed.data.max_results ?? 50;

    // Fetch new emails
    const newEmails = await fetchNewEmails(gmailClient, since, maxResults);
    const sentEmails = await fetchSentEmails(gmailClient, since, maxResults);

    let actionsCreated = 0;
    let interactionsCreated = 0;

    // Process new incoming emails
    for (const email of newEmails) {
      // Find or create contact
      const contact = await db
        .prepare('SELECT id FROM contacts WHERE user_id = ? AND email = ?')
        .bind(userId, email.from)
        .first<{ id: string }>();

      const contactId = contact?.id ?? null;

      // Create interaction record
      const interactionResult = await db
        .prepare(
          `INSERT INTO interactions (id, user_id, contact_id, type, subject, body, channel, metadata, occurred_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          userId,
          contactId,
          'email_received',
          email.subject,
          email.body.substring(0, 5000),
          'email',
          JSON.stringify({
            gmail_id: email.id,
            thread_id: email.threadId,
            from: email.from,
            from_name: email.fromName,
          }),
          email.date.toISOString(),
          new Date().toISOString()
        )
        .run();

      if (interactionResult.success) interactionsCreated++;

      // Classify with Haiku for fast triage
      if (contactId) {
        try {
          const classification = await aiGateway({
            model: 'haiku',
            userId,
            agentType: 'orchestrator',
            db,
            apiKey: c.env.ANTHROPIC_API_KEY,
            messages: [
              {
                role: 'user',
                content: `Classify this email and respond with JSON only:
Subject: ${email.subject}
From: ${email.fromName ?? email.from}
Body: ${email.body.substring(0, 2000)}

Respond with JSON: { "intent": "interested|question|objection|not_now|referral|ooo", "sentiment": "positive|neutral|negative", "urgency": "immediate|today|this_week|no_rush", "suggested_action": "follow_up|reply_needed|warm_intro|meeting_prep|new_prospect|deal_cold|candidate_responded|log_notes|null", "summary": "one sentence summary" }`,
              },
            ],
          });

          const result = JSON.parse(classification.content);

          // Create action card if suggested
          if (result.suggested_action) {
            const actionResult = await db
              .prepare(
                `INSERT INTO actions (id, user_id, contact_id, type, title, description, priority, status, agent_type, metadata, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              )
              .bind(
                crypto.randomUUID(),
                userId,
                contactId,
                result.suggested_action,
                `${result.suggested_action === 'reply_needed' ? 'Reply to' : 'Follow up with'}: ${email.fromName ?? email.from}`,
                result.summary,
                result.urgency === 'immediate'
                  ? 'urgent'
                  : result.urgency === 'today'
                    ? 'high'
                    : result.urgency === 'this_week'
                      ? 'medium'
                      : 'low',
                'pending',
                'orchestrator',
                JSON.stringify({
                  email_id: email.id,
                  thread_id: email.threadId,
                  classification: result,
                }),
                new Date().toISOString(),
                new Date().toISOString()
              )
              .run();
            if (actionResult.success) actionsCreated++;
          }
        } catch (classifyError) {
          console.error('[sync/email] Classification failed for email:', email.id, classifyError);
        }
      }
    }

    // Process sent emails as interactions
    for (const email of sentEmails) {
      for (const recipient of email.to) {
        const contact = await db
          .prepare('SELECT id FROM contacts WHERE user_id = ? AND email = ?')
          .bind(userId, recipient)
          .first<{ id: string }>();

        if (contact) {
          const interactionResult = await db
            .prepare(
              `INSERT INTO interactions (id, user_id, contact_id, type, subject, body, channel, metadata, occurred_at, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              crypto.randomUUID(),
              userId,
              contact.id,
              'email_sent',
              email.subject,
              email.body.substring(0, 5000),
              'email',
              JSON.stringify({
                gmail_id: email.id,
                thread_id: email.threadId,
              }),
              email.date.toISOString(),
              new Date().toISOString()
            )
            .run();

          if (interactionResult.success) interactionsCreated++;

          // Update last interaction
          await db
            .prepare('UPDATE contacts SET last_interaction_at = ? WHERE id = ?')
            .bind(email.date.toISOString(), contact.id)
            .run();
        }
      }
    }

    return c.json({
      success: true,
      emails_fetched: newEmails.length + sentEmails.length,
      incoming: newEmails.length,
      sent: sentEmails.length,
      interactions_created: interactionsCreated,
      actions_created: actionsCreated,
    });
  } catch (error) {
    console.error('[sync/email] Email sync failed:', error);
    return c.json({ error: 'Email sync failed' }, 500);
  }
});

// ─── POST /sync/calendar ────────────────────────────────────────────────────

sync.post('/calendar', async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = calendarSyncSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  try {
    const db = c.env.DB;

    // Fetch user's Google linked account
    const linkedAccount = await db
      .prepare(
        'SELECT * FROM linked_accounts WHERE user_id = ? AND provider = ? AND is_active = 1'
      )
      .bind(userId, 'google')
      .first();

    if (!linkedAccount) {
      return c.json({ error: 'No active Google account linked' }, 400);
    }

    const calendarClient = getCalendarClient(
      c.env,
      linkedAccount.access_token as string,
      (linkedAccount.refresh_token as string) ?? undefined
    );

    const now = new Date();
    const timeMin = parsed.data.time_min ? new Date(parsed.data.time_min) : now;
    const timeMax = parsed.data.time_max
      ? new Date(parsed.data.time_max)
      : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Default: next 7 days

    const events = await fetchEvents(calendarClient, timeMin, timeMax);

    let actionsCreated = 0;

    for (const event of events) {
      // Skip events without attendees (personal blocks)
      if (event.attendees.length === 0) continue;

      // Find contacts matching attendees
      const attendeeEmails = event.attendees
        .filter((a) => !a.self)
        .map((a) => a.email);

      if (attendeeEmails.length === 0) continue;

      // Query contacts matching attendee emails
      const placeholders = attendeeEmails.map(() => '?').join(',');
      const matchedContacts = await db
        .prepare(
          `SELECT id, full_name, email, title, company_id FROM contacts
           WHERE user_id = ? AND email IN (${placeholders})`
        )
        .bind(userId, ...attendeeEmails)
        .all<{ id: string; full_name: string; email: string; title: string | null; company_id: string | null }>();

      if (matchedContacts.results.length > 0) {
        // Create meeting prep action for the first matched contact
        const primaryContact = matchedContacts.results[0];

        const actionResult = await db
          .prepare(
            `INSERT INTO actions (id, user_id, contact_id, type, title, description, priority, status, agent_type, due_at, metadata, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            userId,
            primaryContact.id,
            'meeting_prep',
            `Prep for: ${event.summary}`,
            `Meeting with ${matchedContacts.results.map((c) => c.full_name).join(', ')} on ${event.start.toLocaleDateString()}`,
            'medium',
            'pending',
            'orchestrator',
            new Date(event.start.getTime() - 30 * 60 * 1000).toISOString(),
            JSON.stringify({
              event_id: event.id,
              event_summary: event.summary,
              event_start: event.start.toISOString(),
              attendees: attendeeEmails,
              matched_contacts: matchedContacts.results.map((mc) => ({
                id: mc.id,
                name: mc.full_name,
              })),
            }),
            new Date().toISOString(),
            new Date().toISOString()
          )
          .run();

        if (actionResult.success) actionsCreated++;
      }
    }

    return c.json({
      success: true,
      events_fetched: events.length,
      actions_created: actionsCreated,
    });
  } catch (error) {
    console.error('[sync/calendar] Calendar sync failed:', error);
    return c.json({ error: 'Calendar sync failed' }, 500);
  }
});

// ─── POST /sync/contacts ────────────────────────────────────────────────────

sync.post('/contacts', async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json();
  const parsed = contactEnrichSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { contact_ids } = parsed.data;

  try {
    const db = c.env.DB;

    // Fetch contacts to enrich
    const placeholders = contact_ids.map(() => '?').join(',');
    const contactsResult = await db
      .prepare(
        `SELECT * FROM contacts WHERE user_id = ? AND id IN (${placeholders})`
      )
      .bind(userId, ...contact_ids)
      .all();

    const contacts = contactsResult.results;

    if (!contacts || contacts.length === 0) {
      return c.json({ error: 'Failed to fetch contacts' }, 500);
    }

    let enrichedCount = 0;
    const results: Array<{ contact_id: string; enriched: boolean; error?: string }> = [];

    for (const contact of contacts) {
      try {
        const enriched = await enrichPerson(c.env.APOLLO_API_KEY, {
          email: (contact.email as string) ?? undefined,
          first_name: (contact.first_name as string) ?? undefined,
          last_name: (contact.last_name as string) ?? undefined,
          linkedin_url: (contact.linkedin_url as string) ?? undefined,
        });

        if (enriched) {
          // Update contact with enrichment data
          await db
            .prepare(
              `UPDATE contacts SET title = ?, linkedin_url = ?, avatar_url = ?, enrichment_data = ?, updated_at = ?
               WHERE id = ?`
            )
            .bind(
              enriched.title || (contact.title as string),
              enriched.linkedin_url || (contact.linkedin_url as string),
              enriched.photo_url || (contact.avatar_url as string),
              JSON.stringify(enriched),
              new Date().toISOString(),
              contact.id as string
            )
            .run();

          // If we got organization data, upsert the company
          if (enriched.organization) {
            const org = enriched.organization;

            if (org.website_url) {
              const existingCompany = await db
                .prepare('SELECT id FROM companies WHERE user_id = ? AND domain = ?')
                .bind(userId, org.website_url)
                .first<{ id: string }>();

              if (existingCompany) {
                await db
                  .prepare(
                    `UPDATE companies SET name = ?, industry = ?, size = ?, logo_url = ?, linkedin_url = ?, description = ?, enrichment_data = ?, updated_at = ?
                     WHERE id = ?`
                  )
                  .bind(
                    org.name,
                    org.industry,
                    org.estimated_num_employees?.toString() ?? null,
                    org.logo_url,
                    org.linkedin_url,
                    org.short_description,
                    JSON.stringify(org),
                    new Date().toISOString(),
                    existingCompany.id
                  )
                  .run();

                // Link contact to company
                await db
                  .prepare('UPDATE contacts SET company_id = ? WHERE id = ?')
                  .bind(existingCompany.id, contact.id as string)
                  .run();
              } else {
                const companyId = crypto.randomUUID();
                await db
                  .prepare(
                    `INSERT INTO companies (id, user_id, name, domain, industry, size, logo_url, linkedin_url, description, enrichment_data, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                  )
                  .bind(
                    companyId,
                    userId,
                    org.name,
                    org.website_url,
                    org.industry,
                    org.estimated_num_employees?.toString() ?? null,
                    org.logo_url,
                    org.linkedin_url,
                    org.short_description,
                    JSON.stringify(org),
                    new Date().toISOString(),
                    new Date().toISOString()
                  )
                  .run();

                await db
                  .prepare('UPDATE contacts SET company_id = ? WHERE id = ?')
                  .bind(companyId, contact.id as string)
                  .run();
              }
            }
          }

          enrichedCount++;
          results.push({ contact_id: contact.id as string, enriched: true });
        } else {
          results.push({ contact_id: contact.id as string, enriched: false, error: 'No match found' });
        }
      } catch (enrichError) {
        const errorMsg = enrichError instanceof Error ? enrichError.message : 'Unknown error';
        results.push({ contact_id: contact.id as string, enriched: false, error: errorMsg });
      }
    }

    return c.json({
      success: true,
      total: contacts.length,
      enriched: enrichedCount,
      results,
    });
  } catch (error) {
    console.error('[sync/contacts] Contact enrichment failed:', error);
    return c.json({ error: 'Contact enrichment failed' }, 500);
  }
});

export default sync;
