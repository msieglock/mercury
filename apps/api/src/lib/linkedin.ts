import type { Bindings } from '../middleware/auth.js';

// ─── LinkedIn API Client ────────────────────────────────────────────────────
// Uses LinkedIn v2 API for profile and connections data.
// Note: LinkedIn messaging API requires special partner approval.

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';

interface LinkedInTokens {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

interface LinkedInProfile {
  id: string;
  localizedFirstName: string;
  localizedLastName: string;
  profilePicture?: string;
  headline?: string;
  vanityName?: string;
}

interface LinkedInEmail {
  emailAddress: string;
}

// ─── OAuth ──────────────────────────────────────────────────────────────────

export function getLinkedInAuthUrl(env: Bindings, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.LINKEDIN_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    scope: 'openid profile email w_member_social',
    state: crypto.randomUUID(),
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

export async function exchangeLinkedInCode(
  env: Bindings,
  code: string,
  redirectUri: string
): Promise<LinkedInTokens> {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: env.LINKEDIN_CLIENT_ID ?? '',
      client_secret: env.LINKEDIN_CLIENT_SECRET ?? '',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LinkedIn token exchange failed: ${err}`);
  }

  return res.json() as Promise<LinkedInTokens>;
}

// ─── Profile ────────────────────────────────────────────────────────────────

export async function getLinkedInProfile(accessToken: string): Promise<LinkedInProfile> {
  const res = await fetch(`${LINKEDIN_API_BASE}/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams),headline,vanityName)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error('Failed to fetch LinkedIn profile');
  return res.json() as Promise<LinkedInProfile>;
}

export async function getLinkedInEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(`${LINKEDIN_API_BASE}/emailAddress?q=members&projection=(elements*(handle~))`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return null;

  const data = await res.json() as {
    elements: Array<{ 'handle~': { emailAddress: string } }>;
  };

  return data.elements?.[0]?.['handle~']?.emailAddress ?? null;
}

// ─── Connections (requires r_1st_connections scope — partner only) ──────────
// For most apps, LinkedIn connections are imported via CSV.
// This function is available if the app has partner-level API access.

export async function fetchLinkedInConnections(
  accessToken: string,
  start = 0,
  count = 50
): Promise<Array<{ id: string; firstName: string; lastName: string; headline?: string }>> {
  const res = await fetch(
    `${LINKEDIN_API_BASE}/connections?q=viewer&start=${start}&count=${count}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    // This endpoint requires partner API access
    console.warn('[linkedin] Connections API not available — use CSV import');
    return [];
  }

  const data = await res.json() as {
    elements: Array<{
      miniProfile: { publicIdentifier: string; firstName: string; lastName: string; headline?: string };
    }>;
  };

  return (data.elements ?? []).map((e) => ({
    id: e.miniProfile.publicIdentifier,
    firstName: e.miniProfile.firstName,
    lastName: e.miniProfile.lastName,
    headline: e.miniProfile.headline,
  }));
}
