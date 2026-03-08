import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';

import { authMiddleware, type AuthEnv, type Bindings } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import syncRoutes from './routes/sync.js';
import aiRoutes from './routes/ai.js';
import actionsRoutes from './routes/actions.js';
import contactsRoutes from './routes/contacts.js';
import pipelinesRoutes from './routes/pipelines.js';
import inboxRoutes from './routes/inbox.js';
import onboardingRoutes from './routes/onboarding.js';
import settingsRoutes from './routes/settings.js';
import notificationsRoutes from './routes/notifications.js';
import searchRoutes from './routes/search.js';
import analyticsRoutes from './routes/analytics.js';
import sequencesRoutes from './routes/sequences.js';
import organizationsRoutes from './routes/organizations.js';
import { handleScheduled } from './jobs/scheduled.js';
import { parseInboundSms } from './lib/twilio.js';

// ─── App ────────────────────────────────────────────────────────────────────

const app = new Hono<AuthEnv>();

// ─── Global Middleware ──────────────────────────────────────────────────────

// CORS
app.use(
  '*',
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8081',
      'https://mercury-web-cte.pages.dev',
    ],
    allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
    credentials: true,
  })
);

// Request logging
app.use('*', logger());

// ─── Error Handling ─────────────────────────────────────────────────────────

app.onError((err, c) => {
  console.error(`[error] ${c.req.method} ${c.req.path}:`, err);

  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.message,
        status: err.status,
      },
      err.status
    );
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    return c.json(
      {
        error: 'Validation failed',
        details: err,
      },
      400
    );
  }

  return c.json(
    {
      error: 'Internal server error',
      message: c.env.ENVIRONMENT === 'development' ? err.message : undefined,
    },
    500
  );
});

// ─── Health Check ───────────────────────────────────────────────────────────

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'mercury-api',
    runtime: 'cloudflare-workers',
    timestamp: new Date().toISOString(),
  });
});

// ─── Public Routes ──────────────────────────────────────────────────────────

// Auth routes (mostly public -- OAuth callbacks)
app.route('/auth', authRoutes);

// ─── Protected Routes ───────────────────────────────────────────────────────

// Apply auth middleware to all protected routes
const protectedApp = new Hono<AuthEnv>();
protectedApp.use('*', authMiddleware);

// User profile endpoint
protectedApp.get('/me', async (c) => {
  const user = c.get('user');
  const userId = c.get('userId');
  const userObj = user as unknown as Record<string, unknown>;

  // Fetch pipeline value
  let pipelineValue = 0;
  try {
    const pv = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(pi.value), 0) as total
       FROM pipeline_items pi JOIN pipelines p ON pi.pipeline_id = p.id
       WHERE p.user_id = ?`
    ).bind(userId).first<{ total: number }>();
    pipelineValue = pv?.total ?? 0;
  } catch {}

  // Fetch unread notification count
  let unreadNotifications = 0;
  try {
    const nc = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'
    ).bind(userId).first<{ count: number }>();
    unreadNotifications = nc?.count ?? 0;
  } catch {}

  return c.json({
    user: {
      ...user,
      hasStyleFingerprint: !!userObj?.style_fingerprint,
      pipelineValue,
      unreadNotifications,
    },
  });
});

// Mount route groups
protectedApp.route('/sync', syncRoutes);
protectedApp.route('/ai', aiRoutes);
protectedApp.route('/actions', actionsRoutes);
protectedApp.route('/contacts', contactsRoutes);
protectedApp.route('/pipelines', pipelinesRoutes);
protectedApp.route('/inbox', inboxRoutes);
protectedApp.route('/onboarding', onboardingRoutes);
protectedApp.route('/settings', settingsRoutes);
protectedApp.route('/notifications', notificationsRoutes);
protectedApp.route('/search', searchRoutes);
protectedApp.route('/analytics', analyticsRoutes);
protectedApp.route('/sequences', sequencesRoutes);
protectedApp.route('/organizations', organizationsRoutes);

// Mount protected routes under /api
app.route('/api', protectedApp);

// ─── Twilio Inbound SMS Webhook (public — no auth) ─────────────────────────

app.post('/webhooks/twilio/sms', async (c) => {
  try {
    const formData = await c.req.parseBody() as Record<string, string>;
    const sms = parseInboundSms(formData);

    if (!sms.from || !sms.body) {
      return c.text('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', 200, { 'Content-Type': 'text/xml' });
    }

    const db = c.env.DB;

    // Find contact by phone number (strip formatting for matching)
    const cleanPhone = sms.from.replace(/\D/g, '');
    const contact = await db.prepare(
      `SELECT c.id as contact_id, c.user_id, c.full_name
       FROM contacts c
       WHERE REPLACE(REPLACE(REPLACE(c.phone, '-', ''), ' ', ''), '+', '') LIKE ?
       LIMIT 1`
    ).bind(`%${cleanPhone.slice(-10)}`).first<{ contact_id: string; user_id: string; full_name: string }>();

    if (contact) {
      await db.prepare(
        `INSERT INTO interactions (id, user_id, contact_id, channel, direction, body_snippet, metadata, occurred_at, created_at)
         VALUES (?, ?, ?, 'text', 'inbound', ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(), contact.user_id, contact.contact_id,
        sms.body.substring(0, 5000),
        JSON.stringify({ twilio_sid: sms.messageSid, from: sms.from }),
        new Date().toISOString(), new Date().toISOString()
      ).run();

      await db.prepare('UPDATE contacts SET last_interaction_at = ? WHERE id = ?')
        .bind(new Date().toISOString(), contact.contact_id).run();
    }

    return c.text('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', 200, { 'Content-Type': 'text/xml' });
  } catch (error) {
    console.error('[twilio/webhook] Inbound SMS processing failed:', error);
    return c.text('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', 200, { 'Content-Type': 'text/xml' });
  }
});

// ─── 404 Handler ────────────────────────────────────────────────────────────

app.notFound((c) => {
  return c.json(
    {
      error: 'Not found',
      path: c.req.path,
    },
    404
  );
});

// ─── Cloudflare Workers Export ──────────────────────────────────────────────

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    await handleScheduled(event, env, ctx);
  },
};
