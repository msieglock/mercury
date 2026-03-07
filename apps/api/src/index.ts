import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';

import { authMiddleware, type AuthEnv } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import syncRoutes from './routes/sync.js';
import aiRoutes from './routes/ai.js';
import actionsRoutes from './routes/actions.js';
import contactsRoutes from './routes/contacts.js';
import pipelinesRoutes from './routes/pipelines.js';
import inboxRoutes from './routes/inbox.js';
import onboardingRoutes from './routes/onboarding.js';
import { initScheduler } from './jobs/scheduler.js';

// ─── App ────────────────────────────────────────────────────────────────────

const app = new Hono();

// ─── Global Middleware ──────────────────────────────────────────────────────

// CORS
app.use(
  '*',
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8081',
      process.env.WEB_URL ?? 'http://localhost:3000',
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
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    },
    500
  );
});

// ─── Health Check ───────────────────────────────────────────────────────────

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'mercury-api',
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

// ─── Start Server ───────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT ?? '3001', 10);

console.log(`Mercury API starting on port ${port}...`);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Mercury API running at http://localhost:${info.port}`);

    // Initialize background job scheduler
    if (process.env.ENABLE_JOBS !== 'false') {
      initScheduler().catch((err) => {
        console.error('[scheduler] Failed to initialize job scheduler:', err);
      });
    }
  }
);

export default app;
