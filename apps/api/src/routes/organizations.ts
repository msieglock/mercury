import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../middleware/auth.js';
import { getUserId } from '../middleware/auth.js';

const orgs = new Hono<AuthEnv>();

// ─── Schemas ────────────────────────────────────────────────────────────────

const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  domain: z.string().optional(),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).optional(),
});

// ─── GET /organizations ─────────────────────────────────────────────────────

orgs.get('/', async (c) => {
  const userId = getUserId(c);

  try {
    const db = c.env.DB;

    const result = await db
      .prepare(
        `SELECT o.*, om.role as my_role,
                (SELECT COUNT(*) FROM org_members WHERE org_id = o.id) as member_count
         FROM organizations o
         JOIN org_members om ON om.org_id = o.id
         WHERE om.user_id = ?`
      )
      .bind(userId)
      .all();

    return c.json({ organizations: result.results ?? [] });
  } catch (error) {
    console.error('[orgs] Failed to fetch:', error);
    return c.json({ error: 'Failed to fetch organizations' }, 500);
  }
});

// ─── GET /organizations/:id ─────────────────────────────────────────────────

orgs.get('/:id', async (c) => {
  const userId = getUserId(c);
  const orgId = c.req.param('id');

  try {
    const db = c.env.DB;

    // Verify membership
    const membership = await db
      .prepare('SELECT role FROM org_members WHERE org_id = ? AND user_id = ?')
      .bind(orgId, userId)
      .first<{ role: string }>();

    if (!membership) return c.json({ error: 'Not a member of this organization' }, 403);

    const [org, membersResult] = await Promise.all([
      db.prepare('SELECT * FROM organizations WHERE id = ?').bind(orgId).first(),
      db.prepare(
        `SELECT om.*, u.full_name, u.email, u.avatar_url
         FROM org_members om
         JOIN users u ON om.user_id = u.id
         WHERE om.org_id = ?`
      ).bind(orgId).all(),
    ]);

    return c.json({
      organization: org,
      members: membersResult.results ?? [],
      my_role: membership.role,
    });
  } catch (error) {
    console.error('[orgs] Failed to fetch org:', error);
    return c.json({ error: 'Failed to fetch organization' }, 500);
  }
});

// ─── POST /organizations ────────────────────────────────────────────────────

orgs.post('/', async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json();
  const parsed = createOrgSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  try {
    const db = c.env.DB;
    const orgId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO organizations (id, name, domain, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(orgId, parsed.data.name, parsed.data.domain ?? null, now, now)
      .run();

    // Add creator as owner
    await db
      .prepare(
        `INSERT INTO org_members (id, org_id, user_id, role, joined_at)
         VALUES (?, ?, ?, 'owner', ?)`
      )
      .bind(crypto.randomUUID(), orgId, userId, now)
      .run();

    // Link user to org
    await db
      .prepare('UPDATE users SET org_id = ? WHERE id = ?')
      .bind(orgId, userId)
      .run();

    return c.json({ id: orgId, success: true }, 201);
  } catch (error) {
    console.error('[orgs] Failed to create:', error);
    return c.json({ error: 'Failed to create organization' }, 500);
  }
});

// ─── POST /organizations/:id/invite ─────────────────────────────────────────

orgs.post('/:id/invite', async (c) => {
  const userId = getUserId(c);
  const orgId = c.req.param('id');
  const body = await c.req.json();
  const parsed = inviteSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  try {
    const db = c.env.DB;

    // Check inviter is admin/owner
    const membership = await db
      .prepare('SELECT role FROM org_members WHERE org_id = ? AND user_id = ?')
      .bind(orgId, userId)
      .first<{ role: string }>();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return c.json({ error: 'Only admins can invite members' }, 403);
    }

    // Find or create the invited user
    let invitedUser = await db
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(parsed.data.email)
      .first<{ id: string }>();

    if (!invitedUser) {
      const newUserId = crypto.randomUUID();
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO users (id, email, full_name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(newUserId, parsed.data.email, parsed.data.email.split('@')[0], now, now)
        .run();
      invitedUser = { id: newUserId };
    }

    // Add membership
    try {
      await db
        .prepare(
          `INSERT INTO org_members (id, org_id, user_id, role, invited_by, joined_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(), orgId, invitedUser.id,
          parsed.data.role ?? 'member', userId, new Date().toISOString()
        )
        .run();

      // Link user to org
      await db
        .prepare('UPDATE users SET org_id = ? WHERE id = ?')
        .bind(orgId, invitedUser.id)
        .run();
    } catch {
      return c.json({ error: 'User is already a member' }, 409);
    }

    return c.json({ success: true, user_id: invitedUser.id });
  } catch (error) {
    console.error('[orgs] Failed to invite:', error);
    return c.json({ error: 'Failed to invite member' }, 500);
  }
});

// ─── DELETE /organizations/:id/members/:userId ──────────────────────────────

orgs.delete('/:id/members/:memberId', async (c) => {
  const userId = getUserId(c);
  const orgId = c.req.param('id');
  const memberId = c.req.param('memberId');

  try {
    const db = c.env.DB;

    // Check remover is admin/owner or removing self
    const myMembership = await db
      .prepare('SELECT role FROM org_members WHERE org_id = ? AND user_id = ?')
      .bind(orgId, userId)
      .first<{ role: string }>();

    if (!myMembership) return c.json({ error: 'Not a member' }, 403);
    if (memberId !== userId && !['owner', 'admin'].includes(myMembership.role)) {
      return c.json({ error: 'Only admins can remove members' }, 403);
    }

    await db
      .prepare('DELETE FROM org_members WHERE org_id = ? AND user_id = ?')
      .bind(orgId, memberId)
      .run();

    await db
      .prepare('UPDATE users SET org_id = NULL WHERE id = ? AND org_id = ?')
      .bind(memberId, orgId)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error('[orgs] Failed to remove member:', error);
    return c.json({ error: 'Failed to remove member' }, 500);
  }
});

export default orgs;
