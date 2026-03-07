import { Hono } from 'hono';
import { z } from 'zod';
import { google } from 'googleapis';
import type { AuthEnv } from '../middleware/auth.js';
import { createSession } from '../middleware/auth.js';

const auth = new Hono<AuthEnv>();

// ─── Schemas ────────────────────────────────────────────────────────────────

const googleCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  redirect_uri: z.string().url().optional(),
});

const microsoftCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  redirect_uri: z.string().url().optional(),
});

const linkedinImportSchema = z.object({
  csv_data: z.string().min(1, 'CSV data is required'),
});

// ─── POST /auth/google ──────────────────────────────────────────────────────

auth.post('/google', async (c) => {
  const body = await c.req.json();
  const parsed = googleCallbackSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { code, redirect_uri } = parsed.data;

  try {
    const oauth2Client = new google.auth.OAuth2(
      c.env.GOOGLE_CLIENT_ID,
      c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri ?? c.env.GOOGLE_REDIRECT_URI
    );

    // Exchange the authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: googleUser } = await oauth2.userinfo.get();

    if (!googleUser.email) {
      return c.json({ error: 'Could not retrieve email from Google' }, 400);
    }

    const db = c.env.DB;

    // Check if user already exists
    const existingUser = await db
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(googleUser.email)
      .first<{ id: string }>();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;

      // Update user profile
      await db
        .prepare(
          'UPDATE users SET full_name = ?, avatar_url = ?, updated_at = ? WHERE id = ?'
        )
        .bind(
          googleUser.name ?? googleUser.email,
          googleUser.picture ?? null,
          new Date().toISOString(),
          userId
        )
        .run();
    } else {
      // Create new user
      userId = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO users (id, email, full_name, avatar_url, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(
          userId,
          googleUser.email,
          googleUser.name ?? googleUser.email,
          googleUser.picture ?? null,
          new Date().toISOString(),
          new Date().toISOString()
        )
        .run();
    }

    // Upsert linked_accounts for Google
    const existingLink = await db
      .prepare(
        'SELECT id FROM linked_accounts WHERE user_id = ? AND provider = ?'
      )
      .bind(userId, 'google')
      .first<{ id: string }>();

    if (existingLink) {
      await db
        .prepare(
          `UPDATE linked_accounts
           SET provider_account_id = ?, access_token = ?, refresh_token = ?,
               token_expires_at = ?, scopes = ?, is_active = 1, updated_at = ?
           WHERE id = ?`
        )
        .bind(
          googleUser.id ?? '',
          tokens.access_token!,
          tokens.refresh_token ?? null,
          tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
          JSON.stringify(tokens.scope?.split(' ') ?? []),
          new Date().toISOString(),
          existingLink.id
        )
        .run();
    } else {
      await db
        .prepare(
          `INSERT INTO linked_accounts (id, user_id, provider, provider_account_id, access_token, refresh_token, token_expires_at, scopes, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          userId,
          'google',
          googleUser.id ?? '',
          tokens.access_token!,
          tokens.refresh_token ?? null,
          tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
          JSON.stringify(tokens.scope?.split(' ') ?? []),
          new Date().toISOString(),
          new Date().toISOString()
        )
        .run();
    }

    // Create a session token in KV
    const sessionToken = await createSession(
      c.env.SESSIONS,
      userId,
      googleUser.email
    );

    return c.json({
      success: true,
      user_id: userId,
      token: sessionToken,
    });
  } catch (error) {
    console.error('[auth/google] OAuth callback failed:', error);
    return c.json({ error: 'Google OAuth callback failed' }, 500);
  }
});

// ─── POST /auth/microsoft ───────────────────────────────────────────────────

auth.post('/microsoft', async (c) => {
  const body = await c.req.json();
  const parsed = microsoftCallbackSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  // TODO: Implement Microsoft OAuth callback
  return c.json(
    { error: 'Microsoft OAuth not yet implemented' },
    501
  );
});

// ─── POST /auth/linkedin/import ─────────────────────────────────────────────

auth.post('/linkedin/import', async (c) => {
  // This endpoint requires authentication (mounted under auth middleware in index.ts)
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Authentication required for LinkedIn import' }, 401);
  }

  const body = await c.req.json();
  const parsed = linkedinImportSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { csv_data } = parsed.data;

  try {
    const db = c.env.DB;

    // Parse CSV data -- LinkedIn exports have headers like:
    // First Name,Last Name,Email Address,Company,Position,Connected On
    const lines = csv_data.split('\n').filter((line) => line.trim());
    if (lines.length < 2) {
      return c.json({ error: 'CSV must contain a header row and at least one data row' }, 400);
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const contacts: Array<{
      full_name: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      title: string | null;
      company_name: string | null;
      linkedin_url: string | null;
    }> = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx] ?? '';
      });

      const firstName = row['first_name'] || row['first name'] || null;
      const lastName = row['last_name'] || row['last name'] || null;
      const fullName =
        firstName && lastName
          ? `${firstName} ${lastName}`
          : firstName || lastName || 'Unknown';

      contacts.push({
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        email: row['email_address'] || row['email address'] || row['email'] || null,
        title: row['position'] || row['title'] || null,
        company_name: row['company'] || row['company_name'] || null,
        linkedin_url: row['profile_url'] || row['linkedin_url'] || null,
      });
    }

    let importedCount = 0;

    for (const contact of contacts) {
      // Try to find existing contact by email or LinkedIn URL
      let existingContactId: string | null = null;

      if (contact.email) {
        const byEmail = await db
          .prepare('SELECT id FROM contacts WHERE user_id = ? AND email = ?')
          .bind(userId, contact.email)
          .first<{ id: string }>();
        existingContactId = byEmail?.id ?? null;
      }

      if (!existingContactId && contact.linkedin_url) {
        const byLinkedIn = await db
          .prepare('SELECT id FROM contacts WHERE user_id = ? AND linkedin_url = ?')
          .bind(userId, contact.linkedin_url)
          .first<{ id: string }>();
        existingContactId = byLinkedIn?.id ?? null;
      }

      if (existingContactId) {
        // Merge: update with LinkedIn data
        await db
          .prepare(
            `UPDATE contacts SET linkedin_url = ?, title = ?, first_name = ?, last_name = ?, updated_at = ?
             WHERE id = ?`
          )
          .bind(
            contact.linkedin_url,
            contact.title,
            contact.first_name,
            contact.last_name,
            new Date().toISOString(),
            existingContactId
          )
          .run();
      } else {
        // Insert new contact
        await db
          .prepare(
            `INSERT INTO contacts (id, user_id, full_name, first_name, last_name, email, title, linkedin_url, segment, outreach_path, relationship_score, tags, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            userId,
            contact.full_name,
            contact.first_name,
            contact.last_name,
            contact.email,
            contact.title,
            contact.linkedin_url,
            'connected',
            'direct_linkedin',
            50,
            JSON.stringify(['linkedin_import']),
            new Date().toISOString(),
            new Date().toISOString()
          )
          .run();
      }

      importedCount++;
    }

    return c.json({
      success: true,
      imported_count: importedCount,
      total_parsed: contacts.length,
    });
  } catch (error) {
    console.error('[auth/linkedin/import] Import failed:', error);
    return c.json({ error: 'LinkedIn CSV import failed' }, 500);
  }
});

export default auth;
