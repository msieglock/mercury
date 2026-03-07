import { createMiddleware } from 'hono/factory';
import type { Context, MiddlewareHandler } from 'hono';
import type { User } from '@mercury/shared/types';

// ─── Bindings type ──────────────────────────────────────────────────────────

export type Bindings = {
  DB: D1Database;
  SESSIONS: KVNamespace;
  CACHE: KVNamespace;
  ANTHROPIC_API_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  APOLLO_API_KEY: string;
  ENVIRONMENT: string;
};

// ─── Env type for Hono context ──────────────────────────────────────────────

export interface AuthEnv {
  Bindings: Bindings;
  Variables: {
    user: User;
    token: string;
    userId: string;
  };
}

// ─── Session data stored in KV ──────────────────────────────────────────────

interface SessionData {
  userId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
}

// ─── Auth Middleware ─────────────────────────────────────────────────────────

/**
 * Hono middleware that verifies a session token via KV lookup
 * and attaches the authenticated user to the request context.
 *
 * Usage:
 *   const app = new Hono<AuthEnv>();
 *   app.use('/protected/*', authMiddleware);
 */
export const authMiddleware: MiddlewareHandler<AuthEnv> = createMiddleware<AuthEnv>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader) {
      return c.json({ error: 'Missing Authorization header' }, 401);
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token || token === authHeader) {
      return c.json({ error: 'Invalid Authorization header format. Expected: Bearer <token>' }, 401);
    }

    try {
      // Look up session in KV
      const sessionJson = await c.env.SESSIONS.get(`session:${token}`);

      if (!sessionJson) {
        return c.json({ error: 'Invalid or expired token' }, 401);
      }

      const session: SessionData = JSON.parse(sessionJson);

      // Check expiry
      if (new Date(session.expiresAt) < new Date()) {
        // Clean up expired session
        await c.env.SESSIONS.delete(`session:${token}`);
        return c.json({ error: 'Token expired' }, 401);
      }

      // Fetch the full user profile from D1
      const userProfile = await c.env.DB.prepare(
        'SELECT * FROM users WHERE id = ?'
      )
        .bind(session.userId)
        .first();

      if (!userProfile) {
        return c.json({ error: 'User profile not found' }, 404);
      }

      // Parse JSON fields that D1 returns as strings
      const user: User = {
        ...userProfile,
        style_fingerprint: typeof userProfile.style_fingerprint === 'string'
          ? JSON.parse(userProfile.style_fingerprint)
          : userProfile.style_fingerprint ?? null,
      } as unknown as User;

      // Attach user data to context
      c.set('user', user);
      c.set('token', token);
      c.set('userId', session.userId);

      await next();
    } catch (error) {
      console.error('[auth] Token verification failed:', error);
      return c.json({ error: 'Authentication failed' }, 401);
    }
  }
);

/**
 * Helper to extract the authenticated user from the Hono context.
 */
export function getUser(c: Context<AuthEnv>): User {
  return c.get('user');
}

export function getUserId(c: Context<AuthEnv>): string {
  return c.get('userId');
}

export function getToken(c: Context<AuthEnv>): string {
  return c.get('token');
}

/**
 * Create a new session in KV and return the session token.
 * Sessions expire after 30 days by default.
 */
export async function createSession(
  kv: KVNamespace,
  userId: string,
  email: string,
  ttlDays: number = 30
): Promise<string> {
  const token = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

  const sessionData: SessionData = {
    userId,
    email,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  // Store in KV with automatic expiration
  await kv.put(`session:${token}`, JSON.stringify(sessionData), {
    expirationTtl: ttlDays * 24 * 60 * 60,
  });

  return token;
}

/**
 * Delete a session from KV (logout).
 */
export async function deleteSession(kv: KVNamespace, token: string): Promise<void> {
  await kv.delete(`session:${token}`);
}
