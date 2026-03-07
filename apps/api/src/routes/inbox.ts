import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../middleware/auth.js';
import { getUserId } from '../middleware/auth.js';
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
    const db = c.env.DB;

    // Fetch interactions with contact and company info
    const interactionsResult = await db
      .prepare(
        `SELECT i.*,
                c.id as contact_id_ref, c.full_name as contact_full_name, c.email as contact_email,
                c.avatar_url as contact_avatar_url, c.title as contact_title, c.company_id as contact_company_id,
                co.id as company_id_ref, co.name as company_name
         FROM interactions i
         LEFT JOIN contacts c ON i.contact_id = c.id
         LEFT JOIN companies co ON c.company_id = co.id
         WHERE i.user_id = ? AND i.type IN ('email_sent', 'email_received', 'sms_sent', 'sms_received')
         ORDER BY i.occurred_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(userId, limit, offset)
      .all();

    const interactions = interactionsResult.results ?? [];

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

    for (const interaction of interactions) {
      const meta = typeof interaction.metadata === 'string'
        ? JSON.parse(interaction.metadata as string)
        : (interaction.metadata as Record<string, unknown> | null);
      const threadId =
        (meta?.thread_id as string) ?? (interaction.contact_id as string) ?? (interaction.id as string);

      if (!threadMap.has(threadId)) {
        const contactObj = interaction.contact_id_ref ? {
          id: interaction.contact_id_ref,
          full_name: interaction.contact_full_name,
          email: interaction.contact_email,
          avatar_url: interaction.contact_avatar_url,
          title: interaction.contact_title,
          company_id: interaction.contact_company_id,
          companies: interaction.company_id_ref ? { id: interaction.company_id_ref, name: interaction.company_name } : null,
        } : null;

        threadMap.set(threadId, {
          thread_id: threadId,
          contact: contactObj,
          last_message: {
            id: interaction.id,
            type: interaction.type,
            subject: interaction.subject,
            body: ((interaction.body as string) ?? '').substring(0, 200),
            occurred_at: interaction.occurred_at,
            sentiment: interaction.sentiment,
          },
          message_count: 1,
          last_activity: interaction.occurred_at as string,
          has_unread: interaction.type === 'email_received' || interaction.type === 'sms_received',
          channel: (interaction.channel as string) ?? 'email',
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
    const db = c.env.DB;

    // Fetch all messages in this thread
    // Match by thread_id in metadata JSON or by contact_id
    const messagesResult = await db
      .prepare(
        `SELECT i.*,
                c.id as contact_id_ref, c.full_name as contact_full_name, c.email as contact_email,
                c.avatar_url as contact_avatar_url, c.title as contact_title
         FROM interactions i
         LEFT JOIN contacts c ON i.contact_id = c.id
         WHERE i.user_id = ?
           AND i.type IN ('email_sent', 'email_received', 'sms_sent', 'sms_received')
           AND (json_extract(i.metadata, '$.thread_id') = ? OR i.contact_id = ?)
         ORDER BY i.occurred_at ASC`
      )
      .bind(userId, threadId, threadId)
      .all();

    const messages = messagesResult.results ?? [];

    if (messages.length === 0) {
      return c.json({ error: 'Thread not found' }, 404);
    }

    const firstMessage = messages[0];
    const contact = firstMessage.contact_id_ref ? {
      id: firstMessage.contact_id_ref,
      full_name: firstMessage.contact_full_name,
      email: firstMessage.contact_email,
      avatar_url: firstMessage.contact_avatar_url,
      title: firstMessage.contact_title,
    } : null;

    // Parse metadata in messages
    const parsedMessages = messages.map((m) => ({
      ...m,
      metadata: typeof m.metadata === 'string' ? JSON.parse(m.metadata as string) : m.metadata,
      contacts: m.contact_id_ref ? {
        id: m.contact_id_ref,
        full_name: m.contact_full_name,
        email: m.contact_email,
        avatar_url: m.contact_avatar_url,
        title: m.contact_title,
      } : null,
    }));

    return c.json({
      thread_id: threadId,
      messages: parsedMessages,
      contact,
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
    const db = c.env.DB;

    // Get the latest messages in the thread to know who to reply to
    const threadMessagesResult = await db
      .prepare(
        `SELECT i.*, c.id as contact_ref_id, c.email as contact_email, c.full_name as contact_full_name
         FROM interactions i
         LEFT JOIN contacts c ON i.contact_id = c.id
         WHERE i.user_id = ?
           AND i.type IN ('email_sent', 'email_received', 'sms_sent', 'sms_received')
           AND (json_extract(i.metadata, '$.thread_id') = ? OR i.contact_id = ?)
         ORDER BY i.occurred_at DESC
         LIMIT 5`
      )
      .bind(userId, threadId, threadId)
      .all();

    const threadMessages = threadMessagesResult.results ?? [];

    if (threadMessages.length === 0) {
      return c.json({ error: 'Thread not found' }, 404);
    }

    const latestMessage = threadMessages[0];
    const recipientEmail = latestMessage.contact_email as string | null;

    if (!recipientEmail) {
      return c.json({ error: 'No email address found for this contact' }, 400);
    }

    let replyBody = parsed.data.body;

    // Optionally generate an AI draft
    if (parsed.data.use_ai_draft) {
      const conversationContext = threadMessages
        .reverse()
        .map((m) => `[${m.type}] ${m.occurred_at}: ${((m.body as string) ?? '').substring(0, 500)}`)
        .join('\n\n');

      const user = await db
        .prepare('SELECT style_fingerprint FROM users WHERE id = ?')
        .bind(userId)
        .first();

      const styleFingerprint = user?.style_fingerprint
        ? typeof user.style_fingerprint === 'string'
          ? JSON.parse(user.style_fingerprint as string)
          : user.style_fingerprint
        : null;

      const response = await aiGateway({
        model: 'sonnet',
        userId,
        agentType: 'composer',
        db,
        apiKey: c.env.ANTHROPIC_API_KEY,
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
        system: styleFingerprint
          ? `Match this writing style: ${JSON.stringify(styleFingerprint)}`
          : 'Write in a professional, conversational tone.',
      });

      replyBody = response.content;
    }

    // Send the reply via Gmail
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

    const meta = typeof latestMessage.metadata === 'string'
      ? JSON.parse(latestMessage.metadata as string)
      : (latestMessage.metadata as Record<string, unknown> | null);
    const gmailThreadId = (meta?.thread_id as string) ?? undefined;

    const result = await sendEmail(gmailClient, {
      to: recipientEmail,
      subject: `Re: ${(latestMessage.subject as string) ?? '(no subject)'}`,
      body: replyBody,
      threadId: gmailThreadId,
    });

    // Log the interaction
    await db
      .prepare(
        `INSERT INTO interactions (id, user_id, contact_id, type, subject, body, channel, metadata, occurred_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        userId,
        latestMessage.contact_ref_id ?? null,
        'email_sent',
        `Re: ${(latestMessage.subject as string) ?? '(no subject)'}`,
        replyBody,
        'email',
        JSON.stringify({
          gmail_id: result.id,
          thread_id: result.threadId,
        }),
        new Date().toISOString(),
        new Date().toISOString()
      )
      .run();

    // Update contact last interaction
    if (latestMessage.contact_ref_id) {
      await db
        .prepare('UPDATE contacts SET last_interaction_at = ? WHERE id = ?')
        .bind(new Date().toISOString(), latestMessage.contact_ref_id as string)
        .run();
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
