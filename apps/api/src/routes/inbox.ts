import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../middleware/auth.js';
import { getUserId } from '../middleware/auth.js';
import { getServiceClient } from '../lib/supabase.js';
import { getGmailClient, sendEmail } from '../lib/gmail.js';
import { aiGateway } from '../lib/ai-gateway.js';

const inbox = new Hono<AuthEnv>();

// ─── Schemas ────────────────────────────────────────────────────────────────

const replySchema = z.object({
  body: z.string().min(1),
  use_ai_draft: z.boolean().optional(),
  ai_instructions: z.string().optional(),
});

// ─── GET /inbox ─────────────────────────────────────────────────────────────

inbox.get('/', async (c) => {
  const userId = getUserId(c);
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const offset = parseInt(c.req.query('offset') ?? '0', 10);

  try {
    const supabase = getServiceClient();

    // Fetch interactions grouped by thread/contact, most recent first
    const { data: interactions, error } = await supabase
      .from('interactions')
      .select(`
        *,
        contacts (
          id,
          full_name,
          email,
          avatar_url,
          title,
          company_id,
          companies (
            id,
            name
          )
        )
      `)
      .eq('user_id', userId)
      .in('type', ['email_sent', 'email_received', 'sms_sent', 'sms_received'])
      .order('occurred_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return c.json({ error: 'Failed to fetch inbox' }, 500);
    }

    // Group by thread_id (from metadata) or contact_id
    const threadMap = new Map<
      string,
      {
        thread_id: string;
        contact: unknown;
        last_message: unknown;
        message_count: number;
        last_activity: string;
        has_unread: boolean;
        channel: string;
      }
    >();

    for (const interaction of interactions ?? []) {
      const meta = interaction.metadata as Record<string, unknown> | null;
      const threadId =
        (meta?.thread_id as string) ?? interaction.contact_id ?? interaction.id;

      if (!threadMap.has(threadId)) {
        threadMap.set(threadId, {
          thread_id: threadId,
          contact: interaction.contacts,
          last_message: {
            id: interaction.id,
            type: interaction.type,
            subject: interaction.subject,
            body: (interaction.body ?? '').substring(0, 200),
            occurred_at: interaction.occurred_at,
            sentiment: interaction.sentiment,
          },
          message_count: 1,
          last_activity: interaction.occurred_at,
          has_unread: interaction.type === 'email_received' || interaction.type === 'sms_received',
          channel: interaction.channel ?? 'email',
        });
      } else {
        const thread = threadMap.get(threadId)!;
        thread.message_count++;
      }
    }

    const threads = Array.from(threadMap.values()).sort(
      (a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime()
    );

    return c.json({
      threads,
      total: threads.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[inbox] Failed to fetch inbox:', error);
    return c.json({ error: 'Failed to fetch inbox' }, 500);
  }
});

// ─── GET /inbox/:threadId ───────────────────────────────────────────────────

inbox.get('/:threadId', async (c) => {
  const userId = getUserId(c);
  const threadId = c.req.param('threadId');

  try {
    const supabase = getServiceClient();

    // Fetch all messages in this thread
    const { data: messages, error } = await supabase
      .from('interactions')
      .select(`
        *,
        contacts (
          id,
          full_name,
          email,
          avatar_url,
          title
        )
      `)
      .eq('user_id', userId)
      .or(
        `metadata->>thread_id.eq.${threadId},contact_id.eq.${threadId}`
      )
      .in('type', ['email_sent', 'email_received', 'sms_sent', 'sms_received'])
      .order('occurred_at', { ascending: true });

    if (error) {
      return c.json({ error: 'Failed to fetch thread' }, 500);
    }

    if (!messages || messages.length === 0) {
      return c.json({ error: 'Thread not found' }, 404);
    }

    return c.json({
      thread_id: threadId,
      messages,
      contact: messages[0].contacts,
      message_count: messages.length,
    });
  } catch (error) {
    console.error('[inbox] Failed to fetch thread:', error);
    return c.json({ error: 'Failed to fetch thread' }, 500);
  }
});

// ─── POST /inbox/:threadId/reply ────────────────────────────────────────────

inbox.post('/:threadId/reply', async (c) => {
  const userId = getUserId(c);
  const threadId = c.req.param('threadId');
  const reqBody = await c.req.json();
  const parsed = replySchema.safeParse(reqBody);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  try {
    const supabase = getServiceClient();

    // Get the latest message in the thread to know who to reply to
    const { data: threadMessages } = await supabase
      .from('interactions')
      .select('*, contacts(id, email, full_name)')
      .eq('user_id', userId)
      .or(
        `metadata->>thread_id.eq.${threadId},contact_id.eq.${threadId}`
      )
      .in('type', ['email_sent', 'email_received', 'sms_sent', 'sms_received'])
      .order('occurred_at', { ascending: false })
      .limit(5);

    if (!threadMessages || threadMessages.length === 0) {
      return c.json({ error: 'Thread not found' }, 404);
    }

    const latestMessage = threadMessages[0];
    const contact = latestMessage.contacts;
    const recipientEmail = contact?.email;

    if (!recipientEmail) {
      return c.json({ error: 'No email address found for this contact' }, 400);
    }

    let replyBody = parsed.data.body;

    // Optionally generate an AI draft
    if (parsed.data.use_ai_draft) {
      const conversationContext = threadMessages
        .reverse()
        .map((m) => `[${m.type}] ${m.occurred_at}: ${m.body?.substring(0, 500)}`)
        .join('\n\n');

      const { data: user } = await supabase
        .from('users')
        .select('style_fingerprint')
        .eq('id', userId)
        .single();

      const response = await aiGateway({
        model: 'sonnet',
        userId,
        agentType: 'composer',
        messages: [
          {
            role: 'user',
            content: `Draft a reply to the latest message in this email thread.

Thread context:
${conversationContext}

${parsed.data.ai_instructions ? `Additional instructions: ${parsed.data.ai_instructions}` : ''}

${parsed.data.body ? `Use this as the starting point/rough draft: ${parsed.data.body}` : ''}

Write just the reply body, no subject line needed. Match the user's natural tone.`,
          },
        ],
        system: user?.style_fingerprint
          ? `Match this writing style: ${JSON.stringify(user.style_fingerprint)}`
          : 'Write in a professional, conversational tone.',
      });

      replyBody = response.content;
    }

    // Send the reply via Gmail
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

    const meta = latestMessage.metadata as Record<string, unknown> | null;
    const gmailThreadId = (meta?.thread_id as string) ?? undefined;

    const result = await sendEmail(gmailClient, {
      to: recipientEmail,
      subject: `Re: ${latestMessage.subject ?? '(no subject)'}`,
      body: replyBody,
      threadId: gmailThreadId,
    });

    // Log the interaction
    await supabase.from('interactions').insert({
      user_id: userId,
      contact_id: contact?.id ?? null,
      type: 'email_sent',
      subject: `Re: ${latestMessage.subject ?? '(no subject)'}`,
      body: replyBody,
      channel: 'email',
      metadata: {
        gmail_id: result.id,
        thread_id: result.threadId,
      },
      occurred_at: new Date().toISOString(),
    });

    // Update contact last interaction
    if (contact?.id) {
      await supabase
        .from('contacts')
        .update({ last_interaction_at: new Date().toISOString() })
        .eq('id', contact.id);
    }

    return c.json({
      success: true,
      message_id: result.id,
      thread_id: result.threadId,
      body: replyBody,
    });
  } catch (error) {
    console.error('[inbox] Reply failed:', error);
    return c.json({ error: 'Failed to send reply' }, 500);
  }
});

export default inbox;
