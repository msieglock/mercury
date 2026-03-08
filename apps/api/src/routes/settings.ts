import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../middleware/auth.js';
import { getUserId } from '../middleware/auth.js';

const settings = new Hono<AuthEnv>();

// ─── Schemas ────────────────────────────────────────────────────────────────

const updateSettingsSchema = z.object({
  mode: z.enum(['sales', 'recruit', 'manage']).optional(),
  formality: z.number().min(1).max(10).optional(),
  warmth: z.number().min(1).max(10).optional(),
  auto_follow_up: z.boolean().optional(),
  auto_respond: z.boolean().optional(),
  auto_log_meetings: z.boolean().optional(),
  notification_prefs: z.record(z.boolean()).optional(),
  timezone: z.string().optional(),
  icp: z.string().optional(),
});

// ─── GET /settings ──────────────────────────────────────────────────────────

settings.get('/', async (c) => {
  const userId = getUserId(c);
  const db = c.env.DB;

  try {
    const user = await db
      .prepare(
        'SELECT mode, style_fingerprint, auto_follow_up, auto_respond, auto_log_meetings, notification_prefs, timezone, icp, settings FROM users WHERE id = ?'
      )
      .bind(userId)
      .first();

    if (!user) return c.json({ error: 'User not found' }, 404);

    const fingerprint = user.style_fingerprint
      ? typeof user.style_fingerprint === 'string'
        ? JSON.parse(user.style_fingerprint as string)
        : user.style_fingerprint
      : null;

    const notifPrefs = user.notification_prefs
      ? typeof user.notification_prefs === 'string'
        ? JSON.parse(user.notification_prefs as string)
        : user.notification_prefs
      : {};

    // Fetch linked accounts
    const accountsResult = await db
      .prepare('SELECT id, provider, provider_uid, scopes, metadata, created_at, updated_at FROM linked_accounts WHERE user_id = ?')
      .bind(userId)
      .all();

    return c.json({
      mode: user.mode ?? 'sales',
      formality: fingerprint?.tone_markers?.formality ?? 5,
      warmth: fingerprint?.tone_markers?.warmth ?? 5,
      auto_follow_up: Boolean(user.auto_follow_up),
      auto_respond: Boolean(user.auto_respond),
      auto_log_meetings: Boolean(user.auto_log_meetings),
      notification_prefs: notifPrefs,
      timezone: user.timezone ?? 'America/New_York',
      icp: user.icp ?? null,
      linked_accounts: (accountsResult.results ?? []).map((a) => ({
        id: a.id,
        provider: a.provider,
        provider_uid: a.provider_uid,
        connected: true,
        scopes: typeof a.scopes === 'string' ? JSON.parse(a.scopes as string) : a.scopes,
        connected_at: a.created_at,
      })),
    });
  } catch (error) {
    console.error('[settings] Failed to fetch settings:', error);
    return c.json({ error: 'Failed to fetch settings' }, 500);
  }
});

// ─── PATCH /settings ────────────────────────────────────────────────────────

settings.patch('/', async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json();
  const parsed = updateSettingsSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  try {
    const db = c.env.DB;
    const setClauses: string[] = ['updated_at = ?'];
    const values: unknown[] = [new Date().toISOString()];

    if (parsed.data.mode !== undefined) {
      setClauses.push('mode = ?');
      values.push(parsed.data.mode);
    }

    if (parsed.data.auto_follow_up !== undefined) {
      setClauses.push('auto_follow_up = ?');
      values.push(parsed.data.auto_follow_up ? 1 : 0);
    }

    if (parsed.data.auto_respond !== undefined) {
      setClauses.push('auto_respond = ?');
      values.push(parsed.data.auto_respond ? 1 : 0);
    }

    if (parsed.data.auto_log_meetings !== undefined) {
      setClauses.push('auto_log_meetings = ?');
      values.push(parsed.data.auto_log_meetings ? 1 : 0);
    }

    if (parsed.data.notification_prefs !== undefined) {
      setClauses.push('notification_prefs = ?');
      values.push(JSON.stringify(parsed.data.notification_prefs));
    }

    if (parsed.data.timezone !== undefined) {
      setClauses.push('timezone = ?');
      values.push(parsed.data.timezone);
    }

    if (parsed.data.icp !== undefined) {
      setClauses.push('icp = ?');
      values.push(parsed.data.icp);
    }

    // Handle formality/warmth — update style_fingerprint
    if (parsed.data.formality !== undefined || parsed.data.warmth !== undefined) {
      const user = await db
        .prepare('SELECT style_fingerprint FROM users WHERE id = ?')
        .bind(userId)
        .first();

      const fp = user?.style_fingerprint
        ? typeof user.style_fingerprint === 'string'
          ? JSON.parse(user.style_fingerprint as string)
          : user.style_fingerprint
        : { tone_markers: {} };

      if (!fp.tone_markers) fp.tone_markers = {};
      if (parsed.data.formality !== undefined) fp.tone_markers.formality = parsed.data.formality;
      if (parsed.data.warmth !== undefined) fp.tone_markers.warmth = parsed.data.warmth;

      setClauses.push('style_fingerprint = ?');
      values.push(JSON.stringify(fp));
    }

    values.push(userId);

    await db
      .prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error('[settings] Failed to update settings:', error);
    return c.json({ error: 'Failed to update settings' }, 500);
  }
});

// ─── DELETE /settings/accounts/:provider ────────────────────────────────────

settings.delete('/accounts/:provider', async (c) => {
  const userId = getUserId(c);
  const provider = c.req.param('provider');

  try {
    await c.env.DB
      .prepare('DELETE FROM linked_accounts WHERE user_id = ? AND provider = ?')
      .bind(userId, provider)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error('[settings] Failed to disconnect account:', error);
    return c.json({ error: 'Failed to disconnect account' }, 500);
  }
});

export default settings;
