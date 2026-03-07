import { google, calendar_v3 } from 'googleapis';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  start: Date;
  end: Date;
  location: string | null;
  attendees: Array<{
    email: string;
    displayName: string | null;
    responseStatus: string;
    self: boolean;
  }>;
  htmlLink: string | null;
  hangoutLink: string | null;
  status: string;
  organizer: { email: string; displayName: string | null } | null;
}

interface CreateEventInput {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  attendees?: Array<{ email: string }>;
  timeZone?: string;
}

export interface GoogleEnv {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI?: string;
}

// ─── OAuth Client ───────────────────────────────────────────────────────────

function getOAuth2Client(env: GoogleEnv, accessToken: string, refreshToken?: string) {
  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  return oauth2Client;
}

/**
 * Create an authenticated Google Calendar client from user tokens.
 */
export function getCalendarClient(
  env: GoogleEnv,
  accessToken: string,
  refreshToken?: string
): calendar_v3.Calendar {
  const auth = getOAuth2Client(env, accessToken, refreshToken);
  return google.calendar({ version: 'v3', auth });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseEvent(event: calendar_v3.Schema$Event): CalendarEvent {
  return {
    id: event.id!,
    summary: event.summary ?? '(No title)',
    description: event.description ?? null,
    start: new Date(event.start?.dateTime ?? event.start?.date ?? ''),
    end: new Date(event.end?.dateTime ?? event.end?.date ?? ''),
    location: event.location ?? null,
    attendees: (event.attendees ?? []).map((a) => ({
      email: a.email!,
      displayName: a.displayName ?? null,
      responseStatus: a.responseStatus ?? 'needsAction',
      self: a.self ?? false,
    })),
    htmlLink: event.htmlLink ?? null,
    hangoutLink: event.hangoutLink ?? null,
    status: event.status ?? 'confirmed',
    organizer: event.organizer
      ? {
          email: event.organizer.email!,
          displayName: event.organizer.displayName ?? null,
        }
      : null,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch calendar events within a time range.
 */
export async function fetchEvents(
  client: calendar_v3.Calendar,
  timeMin: Date,
  timeMax: Date,
  maxResults: number = 100
): Promise<CalendarEvent[]> {
  const response = await client.events.list({
    calendarId: 'primary',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = response.data.items ?? [];
  return events.map(parseEvent);
}

/**
 * Create a new calendar event.
 */
export async function createEvent(
  client: calendar_v3.Calendar,
  event: CreateEventInput
): Promise<CalendarEvent> {
  const response = await client.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: event.summary,
      description: event.description,
      start: {
        dateTime: event.start.toISOString(),
        timeZone: event.timeZone ?? 'UTC',
      },
      end: {
        dateTime: event.end.toISOString(),
        timeZone: event.timeZone ?? 'UTC',
      },
      location: event.location,
      attendees: event.attendees?.map((a) => ({ email: a.email })),
    },
  });

  return parseEvent(response.data);
}
