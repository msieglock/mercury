import { google, gmail_v1 } from 'googleapis';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ParsedEmail {
  id: string;
  threadId: string;
  from: string;
  fromName: string | null;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  bodyHtml: string | null;
  date: Date;
  labels: string[];
  isRead: boolean;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  cc?: string[];
  bcc?: string[];
  inReplyTo?: string;
  references?: string;
}

// ─── OAuth Client ───────────────────────────────────────────────────────────

function getOAuth2Client(accessToken: string, refreshToken?: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return oauth2Client;
}

/**
 * Create an authenticated Gmail client from user tokens.
 */
export function getGmailClient(
  accessToken: string,
  refreshToken?: string
): gmail_v1.Gmail {
  const auth = getOAuth2Client(accessToken, refreshToken);
  return google.gmail({ version: 'v1', auth });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string {
  const header = headers.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  );
  return header?.value ?? '';
}

function parseEmailAddress(raw: string): { name: string | null; email: string } {
  const match = raw.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].replace(/"/g, '').trim(), email: match[2].trim() };
  }
  return { name: null, email: raw.trim() };
}

function parseAddressList(raw: string): string[] {
  if (!raw) return [];
  return raw.split(',').map((addr) => parseEmailAddress(addr.trim()).email);
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function extractBody(payload: gmail_v1.Schema$MessagePart): { text: string; html: string | null } {
  let text = '';
  let html: string | null = null;

  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    text = decodeBase64Url(payload.body.data);
  } else if (payload.mimeType === 'text/html' && payload.body?.data) {
    html = decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested.text) text = nested.text;
      if (nested.html) html = nested.html;
    }
  }

  return { text, html };
}

function parseMessage(message: gmail_v1.Schema$Message): ParsedEmail {
  const headers = message.payload?.headers ?? [];
  const fromRaw = getHeader(headers, 'From');
  const { name: fromName, email: fromEmail } = parseEmailAddress(fromRaw);

  const { text, html } = extractBody(message.payload!);

  return {
    id: message.id!,
    threadId: message.threadId!,
    from: fromEmail,
    fromName,
    to: parseAddressList(getHeader(headers, 'To')),
    cc: parseAddressList(getHeader(headers, 'Cc')),
    subject: getHeader(headers, 'Subject'),
    body: text || (html ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : ''),
    bodyHtml: html,
    date: new Date(parseInt(message.internalDate!, 10)),
    labels: message.labelIds ?? [],
    isRead: !(message.labelIds ?? []).includes('UNREAD'),
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch sent emails since a given date.
 */
export async function fetchSentEmails(
  client: gmail_v1.Gmail,
  since: Date,
  maxResults: number = 50
): Promise<ParsedEmail[]> {
  const sinceEpoch = Math.floor(since.getTime() / 1000);

  const listResponse = await client.users.messages.list({
    userId: 'me',
    maxResults,
    q: `in:sent after:${sinceEpoch}`,
  });

  const messageIds = listResponse.data.messages ?? [];
  if (messageIds.length === 0) return [];

  const messages = await Promise.all(
    messageIds.map(async (msg) => {
      const full = await client.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'full',
      });
      return parseMessage(full.data);
    })
  );

  return messages;
}

/**
 * Fetch new (unread) emails since a given date.
 */
export async function fetchNewEmails(
  client: gmail_v1.Gmail,
  since: Date,
  maxResults: number = 50
): Promise<ParsedEmail[]> {
  const sinceEpoch = Math.floor(since.getTime() / 1000);

  const listResponse = await client.users.messages.list({
    userId: 'me',
    maxResults,
    q: `is:unread after:${sinceEpoch}`,
  });

  const messageIds = listResponse.data.messages ?? [];
  if (messageIds.length === 0) return [];

  const messages = await Promise.all(
    messageIds.map(async (msg) => {
      const full = await client.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'full',
      });
      return parseMessage(full.data);
    })
  );

  return messages;
}

/**
 * Send an email via the Gmail API.
 */
export async function sendEmail(
  client: gmail_v1.Gmail,
  options: SendEmailOptions
): Promise<{ id: string; threadId: string }> {
  const { to, subject, body, threadId, cc, bcc, inReplyTo, references } = options;

  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
  ];

  if (cc?.length) headers.push(`Cc: ${cc.join(', ')}`);
  if (bcc?.length) headers.push(`Bcc: ${bcc.join(', ')}`);
  if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`);
  if (references) headers.push(`References: ${references}`);

  const rawMessage = `${headers.join('\r\n')}\r\n\r\n${body}`;
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await client.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
      threadId: threadId ?? undefined,
    },
  });

  return {
    id: response.data.id!,
    threadId: response.data.threadId!,
  };
}

/**
 * Fetch Google Contacts (People API) for the authenticated user.
 */
export async function fetchContacts(
  accessToken: string,
  refreshToken?: string,
  maxResults: number = 1000
): Promise<Array<{ name: string; email: string | null; phone: string | null }>> {
  const auth = getOAuth2Client(accessToken, refreshToken);
  const people = google.people({ version: 'v1', auth });

  const response = await people.people.connections.list({
    resourceName: 'people/me',
    pageSize: Math.min(maxResults, 1000),
    personFields: 'names,emailAddresses,phoneNumbers',
  });

  const connections = response.data.connections ?? [];

  return connections.map((person) => ({
    name: person.names?.[0]?.displayName ?? 'Unknown',
    email: person.emailAddresses?.[0]?.value ?? null,
    phone: person.phoneNumbers?.[0]?.value ?? null,
  }));
}
