// ─── Twilio SMS Client ──────────────────────────────────────────────────────
// Uses Twilio REST API directly (no SDK needed for CF Workers)

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

interface SendSmsResult {
  sid: string;
  status: string;
  to: string;
  from: string;
}

// ─── Send SMS ───────────────────────────────────────────────────────────────

export async function sendSms(
  config: TwilioConfig,
  to: string,
  body: string
): Promise<SendSmsResult> {
  const url = `${TWILIO_API_BASE}/Accounts/${config.accountSid}/Messages.json`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${config.accountSid}:${config.authToken}`)}`,
    },
    body: new URLSearchParams({
      To: to,
      From: config.fromNumber,
      Body: body,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio SMS failed: ${err}`);
  }

  const data = await res.json() as { sid: string; status: string; to: string; from: string };
  return {
    sid: data.sid,
    status: data.status,
    to: data.to,
    from: data.from,
  };
}

// ─── Parse Inbound SMS Webhook ──────────────────────────────────────────────

export interface InboundSms {
  messageSid: string;
  from: string;
  to: string;
  body: string;
  numMedia: number;
}

export function parseInboundSms(formData: Record<string, string>): InboundSms {
  return {
    messageSid: formData['MessageSid'] ?? '',
    from: formData['From'] ?? '',
    to: formData['To'] ?? '',
    body: formData['Body'] ?? '',
    numMedia: parseInt(formData['NumMedia'] ?? '0'),
  };
}

// ─── Validate Twilio Webhook Signature ──────────────────────────────────────

export async function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string
): Promise<boolean> {
  // Build the data string: URL + sorted params
  let data = url;
  const sortedKeys = Object.keys(params).sort();
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  // HMAC-SHA1
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));

  return computed === signature;
}
