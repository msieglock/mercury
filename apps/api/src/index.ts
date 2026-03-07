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
import { handleScheduled } from './jobs/scheduled.js';

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

// Mount route groups
protectedApp.route('/sync', syncRoutes);
protectedApp.route('/ai', aiRoutes);
protectedApp.route('/actions', actionsRoutes);
protectedApp.route('/contacts', contactsRoutes);
protectedApp.route('/pipelines', pipelinesRoutes);
protectedApp.route('/inbox', inboxRoutes);
protectedApp.route('/onboarding', onboardingRoutes);

// Mount protected routes under /api
app.route('/api', protectedApp);

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
