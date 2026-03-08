import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/auth.js';
import { getUserId } from '../middleware/auth.js';

const notifications = new Hono<AuthEnv>();

// ─── GET /notifications ─────────────────────────────────────────────────────

notifications.get('/', async (c) => {
  const userId = getUserId(c);
  const limit = parseInt(c.req.query('limit') ?? '50');
  const unreadOnly = c.req.query('unread') === 'true';

  try {
    const db = c.env.DB;
    const whereClause = unreadOnly
      ? 'WHERE user_id = ? AND read = 0'
      : 'WHERE user_id = ?';

    const result = await db
      .prepare(
        `SELECT * FROM notifications ${whereClause} ORDER BY created_at DESC LIMIT ?`
      )
      .bind(userId, limit)
      .all();

    const unreadCount = await db
      .prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0')
      .bind(userId)
      .first<{ count: number }>();

    return c.json({
      notifications: result.results ?? [],
      unread_count: unreadCount?.count ?? 0,
    });
  } catch (error) {
    console.error('[notifications] Failed to fetch:', error);
    return c.json({ error: 'Failed to fetch notifications' }, 500);
  }
});

// ─── PATCH /notifications/:id ───────────────────────────────────────────────

notifications.patch('/:id', async (c) => {
  const userId = getUserId(c);
  const notifId = c.req.param('id');

  try {
    await c.env.DB
      .prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?')
      .bind(notifId, userId)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error('[notifications] Failed to update:', error);
    return c.json({ error: 'Failed to update notification' }, 500);
  }
});

// ─── POST /notifications/read-all ───────────────────────────────────────────

notifications.post('/read-all', async (c) => {
  const userId = getUserId(c);

  try {
    await c.env.DB
      .prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0')
      .bind(userId)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error('[notifications] Failed to mark all read:', error);
    return c.json({ error: 'Failed to mark all read' }, 500);
  }
});

export default notifications;

// ─── Helper: Create notification (used by other modules) ────────────────────

export async function createNotification(
  db: D1Database,
  userId: string,
  type: string,
  title: string,
  body?: string,
  link?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, link, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      userId,
      type,
      title,
      body ?? null,
      link ?? null,
      JSON.stringify(metadata ?? {}),
      new Date().toISOString()
    )
    .run();
}
