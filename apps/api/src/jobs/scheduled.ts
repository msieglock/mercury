import type { Bindings } from '../middleware/auth.js';
import { getGmailClient, fetchNewEmails, fetchSentEmails } from '../lib/gmail.js';
import { getCalendarClient, fetchEvents } from '../lib/calendar.js';
import { enrichPerson } from '../lib/apollo.js';
import { aiGateway } from '../lib/ai-gateway.js';

// ─── Scheduled Event Handler ────────────────────────────────────────────────

/**
 * Cloudflare Cron Trigger handler.
 * Cron schedule (from wrangler.toml):
 *   - * /5 * * * *  -> email sync (every 5 min)
 *   - 0 * * * *     -> follow-up scanner (hourly)
 *   - 0 6 * * *     -> deal scoring (daily at 6 AM)
 */
export async function handleScheduled(
  event: ScheduledEvent,
  env: Bindings,
  ctx: ExecutionContext
): Promise<void> {
  console.log(`[scheduled] Cron trigger: ${event.cron}`);

  switch (event.cron) {
    case '*/5 * * * *':
      ctx.waitUntil(runEmailSync(env));
      break;

    case '0 * * * *':
      ctx.waitUntil(runFollowUpScanner(env));
      break;

    case '0 6 * * *':
      ctx.waitUntil(runDealScoring(env));
      break;

    default:
      console.log(`[scheduled] Unknown cron: ${event.cron}`);
  }
}

// ─── Email Sync ─────────────────────────────────────────────────────────────

async function runEmailSync(env: Bindings): Promise<void> {
  console.log('[scheduled] Running email sync for all users');

  try {
    // Find all users with active Google accounts
    const linkedAccounts = await env.DB.prepare(
      'SELECT DISTINCT user_id, access_token, refresh_token FROM linked_accounts WHERE provider = ? AND is_active = 1'
    )
      .bind('google')
      .all();

    if (!linkedAccounts.results.length) {
      console.log('[scheduled] No users with active Google accounts');
      return;
    }

    for (const account of linkedAccounts.results) {
      try {
        await syncEmailsForUser(
          env,
          account.user_id as string,
          account.access_token as string,
          (account.refresh_token as string) ?? undefined
        );
      } catch (error) {
        console.error(`[scheduled] Email sync failed for user ${account.user_id}:`, error);
      }
    }
  } catch (error) {
    console.error('[scheduled] Email sync batch failed:', error);
  }
}

async function syncEmailsForUser(
  env: Bindings,
  userId: string,
  accessToken: string,
  refreshToken?: string
): Promise<void> {
  const gmailClient = getGmailClient(env, accessToken, refreshToken);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours

  const [newEmails, sentEmails] = await Promise.all([
    fetchNewEmails(gmailClient, since, 50),
    fetchSentEmails(gmailClient, since, 50),
  ]);

  // Process incoming emails
  for (const email of newEmails) {
    const contact = await env.DB.prepare(
      'SELECT id FROM contacts WHERE user_id = ? AND email = ?'
    )
      .bind(userId, email.from)
      .first<{ id: string }>();

    let contactId = contact?.id ?? null;

    // Create contact if new and we have enough info
    if (!contactId && email.fromName) {
      const nameParts = email.fromName.split(' ');
      contactId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO contacts (id, user_id, full_name, first_name, last_name, email, segment, relationship_score, tags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          contactId,
          userId,
          email.fromName,
          nameParts[0] ?? null,
          nameParts.slice(1).join(' ') || null,
          email.from,
          'connected',
          30,
          JSON.stringify(['auto_imported']),
          new Date().toISOString(),
          new Date().toISOString()
        )
        .run();
    }

    // Insert interaction
    await env.DB.prepare(
      `INSERT OR IGNORE INTO interactions (id, user_id, contact_id, type, subject, body, channel, metadata, occurred_at, created_at)
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
  }

  // Process sent emails
  for (const email of sentEmails) {
    for (const recipient of email.to) {
      const contact = await env.DB.prepare(
        'SELECT id FROM contacts WHERE user_id = ? AND email = ?'
      )
        .bind(userId, recipient)
        .first<{ id: string }>();

      if (contact) {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO interactions (id, user_id, contact_id, type, subject, body, channel, metadata, occurred_at, created_at)
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

        await env.DB.prepare(
          'UPDATE contacts SET last_interaction_at = ? WHERE id = ?'
        )
          .bind(email.date.toISOString(), contact.id)
          .run();
      }
    }
  }

  console.log(
    `[scheduled] Synced ${newEmails.length} incoming + ${sentEmails.length} sent emails for user ${userId}`
  );
}

// ─── Follow-Up Scanner ──────────────────────────────────────────────────────

async function runFollowUpScanner(env: Bindings): Promise<void> {
  console.log('[scheduled] Running follow-up scanner');

  try {
    // Get all users
    const usersResult = await env.DB.prepare('SELECT id FROM users').all();

    for (const user of usersResult.results) {
      try {
        await scanFollowUpsForUser(env, user.id as string);
      } catch (error) {
        console.error(`[scheduled] Follow-up scan failed for user ${user.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[scheduled] Follow-up scanner batch failed:', error);
  }
}

async function scanFollowUpsForUser(env: Bindings, userId: string): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const overdueResult = await env.DB.prepare(
    `SELECT c.id, c.full_name, c.email, c.title, c.segment, c.last_interaction_at, c.company_id,
            co.name as company_name
     FROM contacts c
     LEFT JOIN companies co ON c.company_id = co.id
     WHERE c.user_id = ? AND c.last_interaction_at < ? AND c.segment IN ('hot_lead', 'warm', 'needs_followup')
     ORDER BY c.relationship_score DESC
     LIMIT 20`
  )
    .bind(userId, sevenDaysAgo)
    .all();

  const overdueContacts = overdueResult.results ?? [];
  if (overdueContacts.length === 0) return;

  let actionsCreated = 0;

  for (const contact of overdueContacts) {
    // Check if there's already a pending follow-up action
    const existingAction = await env.DB.prepare(
      `SELECT id FROM actions WHERE user_id = ? AND contact_id = ? AND type = 'follow_up' AND status = 'pending'`
    )
      .bind(userId, contact.id as string)
      .first();

    if (existingAction) continue;

    const daysSinceContact = contact.last_interaction_at
      ? Math.floor(
          (Date.now() - new Date(contact.last_interaction_at as string).getTime()) / (24 * 60 * 60 * 1000)
        )
      : null;

    const priority =
      contact.segment === 'hot_lead'
        ? 'urgent'
        : contact.segment === 'warm'
          ? 'high'
          : 'medium';

    await env.DB.prepare(
      `INSERT INTO actions (id, user_id, contact_id, type, title, description, priority, status, agent_type, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        crypto.randomUUID(),
        userId,
        contact.id as string,
        'follow_up',
        `Follow up with ${contact.full_name}`,
        daysSinceContact
          ? `No contact in ${daysSinceContact} days. ${contact.company_name ? `Works at ${contact.company_name}.` : ''}`
          : 'Overdue follow-up needed.',
        priority,
        'pending',
        'cadence',
        JSON.stringify({
          days_since_contact: daysSinceContact,
          segment: contact.segment,
        }),
        new Date().toISOString(),
        new Date().toISOString()
      )
      .run();

    actionsCreated++;
  }

  if (actionsCreated > 0) {
    console.log(`[scheduled] Created ${actionsCreated} follow-up actions for user ${userId}`);
  }
}

// ─── Deal Scoring ───────────────────────────────────────────────────────────

async function runDealScoring(env: Bindings): Promise<void> {
  console.log('[scheduled] Running deal scoring');

  try {
    const usersResult = await env.DB.prepare('SELECT id FROM users').all();

    for (const user of usersResult.results) {
      try {
        await scorDealsForUser(env, user.id as string);
      } catch (error) {
        console.error(`[scheduled] Deal scoring failed for user ${user.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[scheduled] Deal scoring batch failed:', error);
  }
}

async function scorDealsForUser(env: Bindings, userId: string): Promise<void> {
  const itemsResult = await env.DB.prepare(
    `SELECT pi.*, c.full_name as contact_name, co.name as company_name, p.user_id as pipeline_user_id
     FROM pipeline_items pi
     JOIN pipelines p ON pi.pipeline_id = p.id
     LEFT JOIN contacts c ON pi.contact_id = c.id
     LEFT JOIN companies co ON c.company_id = co.id
     WHERE p.user_id = ?`
  )
    .bind(userId)
    .all();

  const items = itemsResult.results ?? [];
  if (items.length === 0) return;

  const itemSummaries = items.map((item) => ({
    id: item.id,
    stage: item.stage,
    contact_name: item.contact_name,
    company: item.company_name,
    value: item.value,
    days_in_stage: Math.floor(
      (Date.now() - new Date(item.updated_at as string).getTime()) / (24 * 60 * 60 * 1000)
    ),
  }));

  try {
    const response = await aiGateway({
      model: 'haiku',
      userId,
      agentType: 'analyst',
      db: env.DB,
      apiKey: env.ANTHROPIC_API_KEY,
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
      console.error('[scheduled] Failed to parse AI scores');
      return;
    }

    for (const scoreItem of scores) {
      await env.DB.prepare(
        'UPDATE pipeline_items SET updated_at = ? WHERE id = ?'
      )
        .bind(new Date().toISOString(), scoreItem.id)
        .run();

      // Create action for high-risk items
      if (scoreItem.risk === 'high') {
        const item = items.find((i) => i.id === scoreItem.id);
        if (item) {
          await env.DB.prepare(
            `INSERT INTO actions (id, user_id, contact_id, type, title, description, priority, status, agent_type, metadata, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
            .bind(
              crypto.randomUUID(),
              userId,
              (item.contact_id as string) ?? null,
              'deal_cold',
              `Deal at risk: ${(item.contact_name as string) ?? 'Unknown'}`,
              `Score: ${scoreItem.score}/100. Currently in "${item.stage}" stage.`,
              'high',
              'pending',
              'analyst',
              JSON.stringify({
                pipeline_item_id: item.id,
                score: scoreItem.score,
                risk: scoreItem.risk,
              }),
              new Date().toISOString(),
              new Date().toISOString()
            )
            .run();
        }
      }
    }

    console.log(`[scheduled] Scored ${scores.length} items for user ${userId}`);
  } catch (error) {
    console.error('[scheduled] AI scoring failed:', error);
  }
}
