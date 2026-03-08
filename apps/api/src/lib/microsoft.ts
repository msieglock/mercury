import type { Bindings } from '../middleware/auth.js';

// ─── Microsoft Graph API Client ─────────────────────────────────────────────

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

interface MicrosoftTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

interface MicrosoftUser {
  id: string;
  mail: string;
  displayName: string;
  userPrincipalName: string;
}

interface MicrosoftMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  body: { content: string; contentType: string };
  from: { emailAddress: { name: string; address: string } };
  toRecipients: Array<{ emailAddress: { name: string; address: string } }>;
  receivedDateTime: string;
  conversationId: string;
  isDraft: boolean;
}

// ─── OAuth ──────────────────────────────────────────────────────────────────

export function getMicrosoftAuthUrl(env: Bindings, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID ?? '',
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'openid email profile Mail.ReadWrite Mail.Send Calendars.Read User.Read offline_access',
    response_mode: 'query',
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeMicrosoftCode(
  env: Bindings,
  code: string,
  redirectUri: string
): Promise<MicrosoftTokens> {
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.MICROSOFT_CLIENT_ID ?? '',
      client_secret: env.MICROSOFT_CLIENT_SECRET ?? '',
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Microsoft token exchange failed: ${err}`);
  }

  return res.json() as Promise<MicrosoftTokens>;
}

export async function getMicrosoftUser(accessToken: string): Promise<MicrosoftUser> {
  const res = await fetch(`${GRAPH_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch Microsoft user');
  return res.json() as Promise<MicrosoftUser>;
}

// ─── Mail ───────────────────────────────────────────────────────────────────

export async function fetchMicrosoftEmails(
  accessToken: string,
  folder: 'inbox' | 'sentitems' = 'inbox',
  since?: Date,
  top = 50
): Promise<MicrosoftMessage[]> {
  let url = `${GRAPH_BASE}/me/mailFolders/${folder}/messages?$top=${top}&$orderby=receivedDateTime desc`;
  if (since) {
    url += `&$filter=receivedDateTime ge ${since.toISOString()}`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    console.error('[microsoft] Failed to fetch emails:', await res.text());
    return [];
  }

  const data = await res.json() as { value: MicrosoftMessage[] };
  return data.value ?? [];
}

export async function sendMicrosoftEmail(
  accessToken: string,
  opts: { to: string; subject: string; body: string; replyToId?: string }
): Promise<{ id: string }> {
  const message = {
    subject: opts.subject,
    body: { contentType: 'Text', content: opts.body },
    toRecipients: [{ emailAddress: { address: opts.to } }],
  };

  let url = `${GRAPH_BASE}/me/sendMail`;
  const payload: Record<string, unknown> = { message, saveToSentItems: true };

  if (opts.replyToId) {
    url = `${GRAPH_BASE}/me/messages/${opts.replyToId}/reply`;
    // reply endpoint uses comment not message
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment: opts.body }),
    });
    if (!res.ok) throw new Error('Failed to send Microsoft reply');
    return { id: opts.replyToId };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to send Microsoft email: ${err}`);
  }

  return { id: crypto.randomUUID() };
}

// ─── Calendar ───────────────────────────────────────────────────────────────

export async function fetchMicrosoftCalendarEvents(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ id: string; subject: string; start: string; end: string; attendees: string[]; location: string }>> {
  const url = `${GRAPH_BASE}/me/calendarview?startDateTime=${startDate.toISOString()}&endDateTime=${endDate.toISOString()}&$top=50`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return [];

  const data = await res.json() as {
    value: Array<{
      id: string;
      subject: string;
      start: { dateTime: string };
      end: { dateTime: string };
      attendees: Array<{ emailAddress: { address: string } }>;
      location: { displayName: string };
    }>;
  };

  return (data.value ?? []).map((e) => ({
    id: e.id,
    subject: e.subject,
    start: e.start.dateTime,
    end: e.end.dateTime,
    attendees: e.attendees.map((a) => a.emailAddress.address),
    location: e.location?.displayName ?? '',
  }));
}
