import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../middleware/auth.js';
import { getUserId } from '../middleware/auth.js';
import { getGmailClient, sendEmail } from '../lib/gmail.js';
import { sendSms } from '../lib/twilio.js';
import { createNotification } from './notifications.js';

const actions = new Hono<AuthEnv>();

// ─── Schemas ────────────────────────────────────────────────────────────────

const updateActionSchema = z.object({
  status: z.enum(['pending', 'snoozed', 'completed', 'dismissed']).optional(),
  snoozed_until: z.string().datetime().optional(),
  draft_subject: z.string().optional(),
  draft_body: z.string().optional(),
});

const sendActionSchema = z.object({
  channel: z.enum(['email', 'sms']).optional(),
  override_to: z.string().email().optional(),
  override_subject: z.string().optional(),
  override_body: z.string().optional(),
});

// ─── GET /actions ───────────────────────────────────────────────────────────

actions.get('/', async (c) => {
  const userId = getUserId(c);

  try {
    const db = c.env.DB;

    // Fetch pending actions with contact and company info
    const actionsResult = await db
      .prepare(
        `SELECT a.*,
                c.id as contact_id_ref, c.full_name as contact_full_name, c.title as contact_title,
                c.email as contact_email, c.avatar_url as contact_avatar_url, c.company_id as contact_company_id,
                co.id as company_id_ref, co.name as company_name
         FROM actions a
         LEFT JOIN contacts c ON a.contact_id = c.id
         LEFT JOIN companies co ON c.company_id = co.id
         WHERE a.user_id = ? AND a.status = 'pending'
         ORDER BY a.priority DESC, a.due_at ASC, a.created_at DESC`
      )
      .bind(userId)
      .all();

    // Map to ActionCardType shape
    const cards = (actionsResult.results ?? []).map((action) => ({
      id: action.id,
      type: action.type,
      title: action.title,
      description: action.body,
      priority: action.priority,
      contact_name: action.contact_full_name ?? null,
      contact_title: action.contact_title ?? null,
      company_name: action.company_name ?? null,
      due_at: action.due_at,
      primary_action_label: getPrimaryActionLabel(action.type as string),
      primary_action_url: null,
      is_overdue: action.due_at ? new Date(action.due_at as string) < new Date() : false,
      metadata: typeof action.metadata === 'string' ? JSON.parse(action.metadata as string) : action.metadata,
    }));

    return c.json({ actions: cards, total: cards.length });
  } catch (error) {
    console.error('[actions] Failed to fetch actions:', error);
    return c.json({ error: 'Failed to fetch actions' }, 500);
  }
});

// ─── PATCH /actions/:id ─────────────────────────────────────────────────────

actions.patch('/:id', async (c) => {
  const userId = getUserId(c);
  const actionId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateActionSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  try {
    const db = c.env.DB;

    // Verify action belongs to user
    const existing = await db
      .prepare('SELECT id, metadata FROM actions WHERE id = ? AND user_id = ?')
      .bind(actionId, userId)
      .first();

    if (!existing) {
      return c.json({ error: 'Action not found' }, 404);
    }

    const setClauses: string[] = ['updated_at = ?'];
    const values: unknown[] = [new Date().toISOString()];

    if (parsed.data.status) {
      // Map 'completed' to 'done' to match schema
      const dbStatus = parsed.data.status === 'completed' ? 'done' : parsed.data.status;
      setClauses.push('status = ?');
      values.push(dbStatus);
    }

    if (parsed.data.snoozed_until) {
      setClauses.push('snoozed_until = ?');
      values.push(parsed.data.snoozed_until);
      setClauses.push('status = ?');
      values.push('snoozed');
    }

    // Store draft edits in metadata
    if (parsed.data.draft_subject || parsed.data.draft_body) {
      const currentMeta = existing.metadata
        ? typeof existing.metadata === 'string'
          ? JSON.parse(existing.metadata as string)
          : existing.metadata
        : {};

      const updatedMeta = {
        ...currentMeta,
        ...(parsed.data.draft_subject && { draft_subject: parsed.data.draft_subject }),
        ...(parsed.data.draft_body && { draft_body: parsed.data.draft_body }),
      };

      setClauses.push('metadata = ?');
      values.push(JSON.stringify(updatedMeta));
    }

    values.push(actionId);

    const updated = await db
      .prepare(
        `UPDATE actions SET ${setClauses.join(', ')} WHERE id = ? RETURNING *`
      )
      .bind(...values)
      .first();

    return c.json({ action: updated });
  } catch (error) {
    console.error('[actions] Failed to update action:', error);
    return c.json({ error: 'Failed to update action' }, 500);
  }
});

// ─── POST /actions/:id/send ─────────────────────────────────────────────────

actions.post('/:id/send', async (c) => {
  const userId = getUserId(c);
  const actionId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parsed = sendActionSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  try {
    const db = c.env.DB;

    // Fetch the action with contact details
    const action = await db
      .prepare(
        `SELECT a.*, c.id as contact_ref_id, c.email as contact_email, c.full_name as contact_full_name, c.phone as contact_phone
         FROM actions a
         LEFT JOIN contacts c ON a.contact_id = c.id
         WHERE a.id = ? AND a.user_id = ?`
      )
      .bind(actionId, userId)
      .first();

    if (!action) {
      return c.json({ error: 'Action not found' }, 404);
    }

    const metadata = action.metadata
      ? typeof action.metadata === 'string'
        ? JSON.parse(action.metadata as string)
        : action.metadata
      : {};
    const channel = parsed.data.channel ?? 'email';
    const to = parsed.data.override_to ?? (action.contact_email as string);
    const subject = parsed.data.override_subject ?? (metadata.draft_subject as string) ?? (action.title as string);
    const messageBody = parsed.data.override_body ?? (metadata.draft_body as string) ?? '';

    if (!to) {
      return c.json({ error: 'No recipient email/phone available' }, 400);
    }

    if (!messageBody) {
      return c.json({ error: 'No message body. Draft a message first.' }, 400);
    }

    if (channel === 'email') {
      // Send via Gmail
      const linkedAccount = await db
        .prepare(
          'SELECT * FROM linked_accounts WHERE user_id = ? AND provider = ?'
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

      const threadId = (metadata.thread_id as string) ?? undefined;

      const result = await sendEmail(gmailClient, {
        to,
        subject,
        body: messageBody,
        threadId,
      });

      // Log the interaction
      await db
        .prepare(
          `INSERT INTO interactions (id, user_id, contact_id, channel, direction, subject, body_snippet, thread_id, metadata, occurred_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          userId,
          action.contact_id,
          'email',
          'outbound',
          subject,
          messageBody.substring(0, 500),
          result.threadId ?? null,
          JSON.stringify({
            gmail_id: result.id,
            thread_id: result.threadId,
            action_id: actionId,
          }),
          new Date().toISOString(),
          new Date().toISOString()
        )
        .run();

      // Mark action as done
      await db
        .prepare(
          'UPDATE actions SET status = ?, updated_at = ? WHERE id = ?'
        )
        .bind('done', new Date().toISOString(), actionId)
        .run();

      // Update contact last interaction
      if (action.contact_id) {
        await db
          .prepare('UPDATE contacts SET last_interaction_at = ? WHERE id = ?')
          .bind(new Date().toISOString(), action.contact_id as string)
          .run();
      }

      return c.json({
        success: true,
        channel: 'email',
        message_id: result.id,
        thread_id: result.threadId,
      });
    } else {
      // SMS via Twilio
      if (!c.env.TWILIO_ACCOUNT_SID || !c.env.TWILIO_AUTH_TOKEN || !c.env.TWILIO_PHONE_NUMBER) {
        return c.json({ error: 'Twilio not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.' }, 400);
      }

      const phone = parsed.data.override_to ?? (action.contact_phone as string);
      if (!phone) {
        return c.json({ error: 'No phone number available for this contact' }, 400);
      }

      const result = await sendSms(
        {
          accountSid: c.env.TWILIO_ACCOUNT_SID,
          authToken: c.env.TWILIO_AUTH_TOKEN,
          fromNumber: c.env.TWILIO_PHONE_NUMBER,
        },
        phone,
        messageBody
      );

      // Log the interaction
      await db
        .prepare(
          `INSERT INTO interactions (id, user_id, contact_id, channel, direction, subject, body_snippet, metadata, occurred_at, created_at)
           VALUES (?, ?, ?, 'text', 'outbound', NULL, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          userId,
          action.contact_id,
          messageBody.substring(0, 500),
          JSON.stringify({ twilio_sid: result.sid, action_id: actionId }),
          new Date().toISOString(),
          new Date().toISOString()
        )
        .run();

      // Mark action as done
      await db.prepare('UPDATE actions SET status = ?, updated_at = ? WHERE id = ?')
        .bind('done', new Date().toISOString(), actionId).run();

      if (action.contact_id) {
        await db.prepare('UPDATE contacts SET last_interaction_at = ? WHERE id = ?')
          .bind(new Date().toISOString(), action.contact_id as string).run();
      }

      return c.json({
        success: true,
        channel: 'sms',
        twilio_sid: result.sid,
      });
    }
  } catch (error) {
    console.error('[actions] Send failed:', error);
    return c.json({ error: 'Failed to send message' }, 500);
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function getPrimaryActionLabel(type: string): string {
  const labels: Record<string, string> = {
    follow_up: 'Send Follow-Up',
    reply_needed: 'Reply Now',
    warm_intro: 'Request Intro',
    meeting_prep: 'View Briefing',
    new_prospect: 'Start Outreach',
    deal_cold: 'Re-engage',
    candidate_responded: 'Review & Reply',
    log_notes: 'Log Notes',
  };
  return labels[type] ?? 'Take Action';
}

export default actions;
