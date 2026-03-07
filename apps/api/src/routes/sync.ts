import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../middleware/auth.js';
import { getUser, getUserId } from '../middleware/auth.js';
import { getServiceClient } from '../lib/supabase.js';
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
    const supabase = getServiceClient();

    // Fetch user's Google linked account
    const { data: linkedAccount, error: linkError } = await supabase
      .from('linked_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .eq('is_active', true)
      .maybeSingle();

    if (linkError || !linkedAccount) {
      return c.json({ error: 'No active Google account linked' }, 400);
    }

    const gmailClient = getGmailClient(
      linkedAccount.access_token,
      linkedAccount.refresh_token ?? undefined
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
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', userId)
        .eq('email', email.from)
        .maybeSingle();

      const contactId = contact?.id ?? null;

      // Create interaction record
      const { error: interactionError } = await supabase.from('interactions').insert({
        user_id: userId,
        contact_id: contactId,
        type: 'email_received',
        subject: email.subject,
        body: email.body.substring(0, 5000), // Truncate long emails
        channel: 'email',
        metadata: {
          gmail_id: email.id,
          thread_id: email.threadId,
          from: email.from,
          from_name: email.fromName,
        },
        occurred_at: email.date.toISOString(),
      });

      if (!interactionError) interactionsCreated++;

      // Classify with Haiku for fast triage
      if (contactId) {
        try {
          const classification = await aiGateway({
            model: 'haiku',
            userId,
            agentType: 'orchestrator',
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
            await supabase.from('actions').insert({
              user_id: userId,
              contact_id: contactId,
              type: result.suggested_action,
              title: `${result.suggested_action === 'reply_needed' ? 'Reply to' : 'Follow up with'}: ${email.fromName ?? email.from}`,
              description: result.summary,
              priority:
                result.urgency === 'immediate'
                  ? 'urgent'
                  : result.urgency === 'today'
                    ? 'high'
                    : result.urgency === 'this_week'
                      ? 'medium'
                      : 'low',
              status: 'pending',
              agent_type: 'orchestrator',
              metadata: {
                email_id: email.id,
                thread_id: email.threadId,
                classification: result,
              },
            });
            actionsCreated++;
          }
        } catch (classifyError) {
          console.error('[sync/email] Classification failed for email:', email.id, classifyError);
        }
      }
    }

    // Process sent emails as interactions
    for (const email of sentEmails) {
      for (const recipient of email.to) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', userId)
          .eq('email', recipient)
          .maybeSingle();

        if (contact) {
          const { error: interactionError } = await supabase.from('interactions').insert({
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
          });

          if (!interactionError) interactionsCreated++;

          // Update last interaction
          await supabase
            .from('contacts')
            .update({ last_interaction_at: email.date.toISOString() })
            .eq('id', contact.id);
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
    const supabase = getServiceClient();

    // Fetch user's Google linked account
    const { data: linkedAccount, error: linkError } = await supabase
      .from('linked_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .eq('is_active', true)
      .maybeSingle();

    if (linkError || !linkedAccount) {
      return c.json({ error: 'No active Google account linked' }, 400);
    }

    const calendarClient = getCalendarClient(
      linkedAccount.access_token,
      linkedAccount.refresh_token ?? undefined
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

      const { data: matchedContacts } = await supabase
        .from('contacts')
        .select('id, full_name, email, title, company_id')
        .eq('user_id', userId)
        .in('email', attendeeEmails);

      if (matchedContacts && matchedContacts.length > 0) {
        // Create meeting prep action for the first matched contact
        const primaryContact = matchedContacts[0];

        const { error: actionError } = await supabase.from('actions').insert({
          user_id: userId,
          contact_id: primaryContact.id,
          type: 'meeting_prep',
          title: `Prep for: ${event.summary}`,
          description: `Meeting with ${matchedContacts.map((c) => c.full_name).join(', ')} on ${event.start.toLocaleDateString()}`,
          priority: 'medium',
          status: 'pending',
          agent_type: 'orchestrator',
          due_at: new Date(event.start.getTime() - 30 * 60 * 1000).toISOString(), // 30 min before
          metadata: {
            event_id: event.id,
            event_summary: event.summary,
            event_start: event.start.toISOString(),
            attendees: attendeeEmails,
            matched_contacts: matchedContacts.map((mc) => ({
              id: mc.id,
              name: mc.full_name,
            })),
          },
        });

        if (!actionError) actionsCreated++;
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
    const supabase = getServiceClient();

    // Fetch contacts to enrich
    const { data: contacts, error: fetchError } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .in('id', contact_ids);

    if (fetchError || !contacts) {
      return c.json({ error: 'Failed to fetch contacts' }, 500);
    }

    let enrichedCount = 0;
    const results: Array<{ contact_id: string; enriched: boolean; error?: string }> = [];

    for (const contact of contacts) {
      try {
        const enriched = await enrichPerson({
          email: contact.email ?? undefined,
          first_name: contact.first_name ?? undefined,
          last_name: contact.last_name ?? undefined,
          linkedin_url: contact.linkedin_url ?? undefined,
        });

        if (enriched) {
          // Update contact with enrichment data
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

          // If we got organization data, upsert the company
          if (enriched.organization) {
            const org = enriched.organization;
            const { data: existingCompany } = await supabase
              .from('companies')
              .select('id')
              .eq('user_id', userId)
              .eq('domain', org.website_url ?? '')
              .maybeSingle();

            if (existingCompany) {
              await supabase
                .from('companies')
                .update({
                  name: org.name,
                  industry: org.industry,
                  size: org.estimated_num_employees?.toString() ?? null,
                  logo_url: org.logo_url,
                  linkedin_url: org.linkedin_url,
                  description: org.short_description,
                  enrichment_data: org as unknown as Record<string, unknown>,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', existingCompany.id);

              // Link contact to company
              await supabase
                .from('contacts')
                .update({ company_id: existingCompany.id })
                .eq('id', contact.id);
            } else if (org.website_url) {
              const { data: newCompany } = await supabase
                .from('companies')
                .insert({
                  user_id: userId,
                  name: org.name,
                  domain: org.website_url,
                  industry: org.industry,
                  size: org.estimated_num_employees?.toString() ?? null,
                  logo_url: org.logo_url,
                  linkedin_url: org.linkedin_url,
                  description: org.short_description,
                  enrichment_data: org as unknown as Record<string, unknown>,
                })
                .select('id')
                .single();

              if (newCompany) {
                await supabase
                  .from('contacts')
                  .update({ company_id: newCompany.id })
                  .eq('id', contact.id);
              }
            }
          }

          enrichedCount++;
          results.push({ contact_id: contact.id, enriched: true });
        } else {
          results.push({ contact_id: contact.id, enriched: false, error: 'No match found' });
        }
      } catch (enrichError) {
        const errorMsg = enrichError instanceof Error ? enrichError.message : 'Unknown error';
        results.push({ contact_id: contact.id, enriched: false, error: errorMsg });
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
