import { Hono } from 'hono';
import { z } from 'zod';
import { google } from 'googleapis';
import { getServiceClient } from '../lib/supabase.js';
import type { AuthEnv } from '../middleware/auth.js';

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
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri ?? process.env.GOOGLE_REDIRECT_URI
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

    const supabase = getServiceClient();

    // Sign in or create user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: googleUser.email,
      email_confirm: true,
      user_metadata: {
        full_name: googleUser.name,
        avatar_url: googleUser.picture,
      },
    });

    // If user already exists, generate a session for them
    let userId: string;
    let session: unknown;

    if (authError?.message?.includes('already been registered')) {
      // User exists -- look up their ID and generate a magic link session
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u) => u.email === googleUser.email);

      if (!existing) {
        return c.json({ error: 'Failed to find existing user' }, 500);
      }

      userId = existing.id;

      // Generate a session token
      const { data: linkData, error: linkError } =
        await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: googleUser.email,
        });

      if (linkError) {
        return c.json({ error: 'Failed to generate session' }, 500);
      }

      session = linkData;
    } else if (authError) {
      return c.json({ error: `Auth error: ${authError.message}` }, 500);
    } else {
      userId = authData.user.id;
      session = authData;
    }

    // Upsert linked_accounts for Google
    const { error: linkAccountError } = await supabase.from('linked_accounts').upsert(
      {
        user_id: userId,
        provider: 'google',
        provider_account_id: googleUser.id,
        access_token: tokens.access_token!,
        refresh_token: tokens.refresh_token ?? null,
        token_expires_at: tokens.expiry_date
          ? new Date(tokens.expiry_date).toISOString()
          : null,
        scopes: tokens.scope?.split(' ') ?? [],
        is_active: true,
      },
      { onConflict: 'user_id,provider' }
    );

    if (linkAccountError) {
      console.error('[auth/google] Failed to upsert linked account:', linkAccountError);
    }

    // Ensure user profile exists in users table
    await supabase.from('users').upsert(
      {
        id: userId,
        email: googleUser.email,
        full_name: googleUser.name ?? googleUser.email,
        avatar_url: googleUser.picture ?? null,
      },
      { onConflict: 'id' }
    );

    return c.json({
      success: true,
      user_id: userId,
      session,
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
  // 1. Exchange code for tokens via Microsoft Graph
  // 2. Get user info from Microsoft
  // 3. Create/update user in Supabase
  // 4. Store linked_account
  // 5. Return session

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

    // Upsert contacts into the database
    const supabase = getServiceClient();
    let importedCount = 0;

    for (const contact of contacts) {
      // Try to find existing contact by email or LinkedIn URL
      let existingContactId: string | null = null;

      if (contact.email) {
        const { data: byEmail } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', userId)
          .eq('email', contact.email)
          .maybeSingle();
        existingContactId = byEmail?.id ?? null;
      }

      if (!existingContactId && contact.linkedin_url) {
        const { data: byLinkedIn } = await supabase
          .from('contacts')
          .select('id')
          .eq('user_id', userId)
          .eq('linkedin_url', contact.linkedin_url)
          .maybeSingle();
        existingContactId = byLinkedIn?.id ?? null;
      }

      if (existingContactId) {
        // Merge: update with LinkedIn data if fields are empty
        await supabase
          .from('contacts')
          .update({
            linkedin_url: contact.linkedin_url,
            title: contact.title,
            first_name: contact.first_name,
            last_name: contact.last_name,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingContactId);
      } else {
        // Insert new contact
        await supabase.from('contacts').insert({
          user_id: userId,
          full_name: contact.full_name,
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email,
          title: contact.title,
          linkedin_url: contact.linkedin_url,
          segment: 'connected',
          outreach_path: 'direct_linkedin',
          relationship_score: 50,
          tags: ['linkedin_import'],
        });
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
