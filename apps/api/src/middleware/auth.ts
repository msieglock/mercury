import { createMiddleware } from 'hono/factory';
import type { Context, MiddlewareHandler } from 'hono';
import { createUserClient, getServiceClient } from '../lib/supabase.js';
import type { User } from '@mercury/shared/types';

// ─── Env type for Hono context ──────────────────────────────────────────────

export interface AuthEnv {
  Variables: {
    user: User;
    token: string;
    userId: string;
  };
}

// ─── Auth Middleware ─────────────────────────────────────────────────────────

/**
 * Hono middleware that verifies a Bearer token via Supabase Auth
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
      // Verify the JWT with Supabase
      const supabase = createUserClient(token);
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authUser) {
        return c.json({ error: 'Invalid or expired token' }, 401);
      }

      // Fetch the full user profile from our users table
      const serviceClient = getServiceClient();
      const { data: userProfile, error: profileError } = await serviceClient
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError || !userProfile) {
        return c.json({ error: 'User profile not found' }, 404);
      }

      // Attach user data to context
      c.set('user', userProfile as User);
      c.set('token', token);
      c.set('userId', authUser.id);

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
