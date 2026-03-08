import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/auth.js';
import { getUserId } from '../middleware/auth.js';

const search = new Hono<AuthEnv>();

// ─── GET /search?q=query ────────────────────────────────────────────────────

search.get('/', async (c) => {
  const userId = getUserId(c);
  const query = c.req.query('q')?.trim();
  const limit = parseInt(c.req.query('limit') ?? '20');

  if (!query || query.length < 2) {
    return c.json({ contacts: [], threads: [], actions: [] });
  }

  const pattern = `%${query}%`;

  try {
    const db = c.env.DB;

    const [contactsResult, threadsResult, actionsResult] = await Promise.all([
      // Search contacts
      db.prepare(
        `SELECT c.id, c.full_name, c.email, c.title, c.avatar_url, c.segment,
                co.name as company_name
         FROM contacts c
         LEFT JOIN companies co ON c.company_id = co.id
         WHERE c.user_id = ? AND (
           c.full_name LIKE ? OR c.email LIKE ? OR c.title LIKE ? OR co.name LIKE ?
         )
         ORDER BY c.relationship_score DESC
         LIMIT ?`
      )
        .bind(userId, pattern, pattern, pattern, pattern, limit)
        .all(),

      // Search interactions (threads)
      db.prepare(
        `SELECT i.id, i.subject, i.body_snippet, i.thread_id, i.channel, i.occurred_at,
                c.full_name as contact_name, c.email as contact_email
         FROM interactions i
         LEFT JOIN contacts c ON i.contact_id = c.id
         WHERE i.user_id = ? AND (
           i.subject LIKE ? OR i.body_snippet LIKE ?
         )
         ORDER BY i.occurred_at DESC
         LIMIT ?`
      )
        .bind(userId, pattern, pattern, limit)
        .all(),

      // Search actions
      db.prepare(
        `SELECT a.id, a.type, a.title, a.body, a.priority, a.status,
                c.full_name as contact_name
         FROM actions a
         LEFT JOIN contacts c ON a.contact_id = c.id
         WHERE a.user_id = ? AND a.status = 'pending' AND (
           a.title LIKE ? OR a.body LIKE ?
         )
         ORDER BY a.priority DESC
         LIMIT ?`
      )
        .bind(userId, pattern, pattern, limit)
        .all(),
    ]);

    return c.json({
      contacts: contactsResult.results ?? [],
      threads: threadsResult.results ?? [],
      actions: actionsResult.results ?? [],
      query,
    });
  } catch (error) {
    console.error('[search] Search failed:', error);
    return c.json({ error: 'Search failed' }, 500);
  }
});

export default search;
