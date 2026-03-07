import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../middleware/auth.js';
import { getUserId } from '../middleware/auth.js';
import { getServiceClient } from '../lib/supabase.js';
import { getGmailClient, sendEmail } from '../lib/gmail.js';

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
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('actions')
      .select(`
        *,
        contacts (
          id,
          full_name,
          title,
          email,
          avatar_url,
          company_id,
          companies (
            id,
            name
          )
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('priority', { ascending: true }) // urgent first
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      return c.json({ error: 'Failed to fetch actions' }, 500);
    }

    // Transform priority to sort order for the client
    const priorityOrder: Record<string, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    const sortedActions = (data ?? []).sort((a, b) => {
      const aPriority = priorityOrder[a.priority] ?? 4;
      const bPriority = priorityOrder[b.priority] ?? 4;
      if (aPriority !== bPriority) return aPriority - bPriority;

      // Then by due date (soonest first)
      if (a.due_at && b.due_at) return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      if (a.due_at) return -1;
      if (b.due_at) return 1;

      // Then by created_at (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // Map to ActionCardType shape
    const cards = sortedActions.map((action) => ({
      id: action.id,
      type: action.type,
      title: action.title,
      description: action.description,
      priority: action.priority,
      agent_type: action.agent_type,
      contact_name: action.contacts?.full_name ?? null,
      contact_title: action.contacts?.title ?? null,
      company_name: action.contacts?.companies?.name ?? null,
      due_at: action.due_at,
      primary_action_label: getPrimaryActionLabel(action.type),
      primary_action_url: null,
      is_overdue: action.due_at ? new Date(action.due_at) < new Date() : false,
      metadata: action.metadata,
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
    const supabase = getServiceClient();

    // Verify action belongs to user
    const { data: existing, error: fetchError } = await supabase
      .from('actions')
      .select('id')
      .eq('id', actionId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existing) {
      return c.json({ error: 'Action not found' }, 404);
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.status) {
      updates.status = parsed.data.status;
      if (parsed.data.status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }
    }

    if (parsed.data.snoozed_until) {
      updates.snoozed_until = parsed.data.snoozed_until;
      updates.status = 'snoozed';
    }

    // Store draft edits in metadata
    if (parsed.data.draft_subject || parsed.data.draft_body) {
      const { data: currentAction } = await supabase
        .from('actions')
        .select('metadata')
        .eq('id', actionId)
        .single();

      const currentMeta = (currentAction?.metadata as Record<string, unknown>) ?? {};
      updates.metadata = {
        ...currentMeta,
        ...(parsed.data.draft_subject && { draft_subject: parsed.data.draft_subject }),
        ...(parsed.data.draft_body && { draft_body: parsed.data.draft_body }),
      };
    }

    const { data: updated, error: updateError } = await supabase
      .from('actions')
      .update(updates)
      .eq('id', actionId)
      .select()
      .single();

    if (updateError) {
      return c.json({ error: 'Failed to update action' }, 500);
    }

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
    const supabase = getServiceClient();

    // Fetch the action with contact details
    const { data: action, error: actionError } = await supabase
      .from('actions')
      .select('*, contacts(id, email, full_name, phone)')
      .eq('id', actionId)
      .eq('user_id', userId)
      .single();

    if (actionError || !action) {
      return c.json({ error: 'Action not found' }, 404);
    }

    const metadata = (action.metadata as Record<string, unknown>) ?? {};
    const channel = parsed.data.channel ?? 'email';
    const to = parsed.data.override_to ?? action.contacts?.email;
    const subject = parsed.data.override_subject ?? (metadata.draft_subject as string) ?? action.title;
    const messageBody = parsed.data.override_body ?? (metadata.draft_body as string) ?? '';

    if (!to) {
      return c.json({ error: 'No recipient email/phone available' }, 400);
    }

    if (!messageBody) {
      return c.json({ error: 'No message body. Draft a message first.' }, 400);
    }

    if (channel === 'email') {
      // Send via Gmail
      const { data: linkedAccount } = await supabase
        .from('linked_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'google')
        .eq('is_active', true)
        .maybeSingle();

      if (!linkedAccount) {
        return c.json({ error: 'No active Google account linked' }, 400);
      }

      const gmailClient = getGmailClient(
        linkedAccount.access_token,
        linkedAccount.refresh_token ?? undefined
      );

      const threadId = (metadata.thread_id as string) ?? undefined;

      const result = await sendEmail(gmailClient, {
        to,
        subject,
        body: messageBody,
        threadId,
      });

      // Log the interaction
      await supabase.from('interactions').insert({
        user_id: userId,
        contact_id: action.contact_id,
        type: 'email_sent',
        subject,
        body: messageBody,
        channel: 'email',
        metadata: {
          gmail_id: result.id,
          thread_id: result.threadId,
          action_id: actionId,
        },
        occurred_at: new Date().toISOString(),
      });

      // Mark action as completed
      await supabase
        .from('actions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', actionId);

      // Update contact last interaction
      if (action.contact_id) {
        await supabase
          .from('contacts')
          .update({ last_interaction_at: new Date().toISOString() })
          .eq('id', action.contact_id);
      }

      return c.json({
        success: true,
        channel: 'email',
        message_id: result.id,
        thread_id: result.threadId,
      });
    } else {
      // SMS sending -- placeholder
      // TODO: Integrate with Twilio for SMS
      return c.json({ error: 'SMS sending not yet implemented' }, 501);
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
