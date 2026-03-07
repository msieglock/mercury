// Mercury Email Sync – Supabase Edge Function
// Background job: fetches new Gmail messages, classifies them with Haiku,
// creates action cards, and updates contact interaction timestamps.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const HAIKU_MODEL = "claude-haiku-4-5-20251001";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailSyncRequest {
  user_id: string;
}

interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{ mimeType: string; body?: { data?: string } }>;
  };
  internalDate: string;
}

interface ClassificationResult {
  sentiment: "positive" | "neutral" | "negative";
  intent: string;
  needs_reply: boolean;
  priority: number;
  summary: string;
}

function getHeader(
  headers: Array<{ name: string; value: string }>,
  name: string
): string | undefined {
  return headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  )?.value;
}

function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : raw.toLowerCase().trim();
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64);
}

function getBodyText(message: GmailMessage): string {
  // Try plain text part first
  if (message.payload.parts) {
    const textPart = message.payload.parts.find(
      (p) => p.mimeType === "text/plain"
    );
    if (textPart?.body?.data) {
      return decodeBase64Url(textPart.body.data);
    }
  }
  // Fall back to top-level body
  if (message.payload.body?.data) {
    return decodeBase64Url(message.payload.body.data);
  }
  return message.snippet || "";
}

async function classifyEmail(
  anthropicApiKey: string,
  subject: string,
  bodySnippet: string,
  senderName: string
): Promise<ClassificationResult> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: HAIKU_MODEL,
      max_tokens: 256,
      system: `You are an email classifier for a CRM. Analyze the email and return a JSON object with:
- sentiment: "positive", "neutral", or "negative"
- intent: a short label like "question", "follow_up", "introduction", "meeting_request", "deal_progress", "feedback", "thank_you", "rejection", "info_sharing"
- needs_reply: boolean - does this email require a response from the user?
- priority: integer 0-100 (100 = most urgent)
- summary: one-sentence summary of the email

Return ONLY the JSON object, no other text.`,
      messages: [
        {
          role: "user",
          content: `From: ${senderName}\nSubject: ${subject}\n\n${bodySnippet.slice(0, 1000)}`,
        },
      ],
    }),
  });

  const result = await response.json();
  const text = result.content?.[0]?.text ?? "{}";

  try {
    return JSON.parse(text);
  } catch {
    return {
      sentiment: "neutral",
      intent: "unknown",
      needs_reply: false,
      priority: 50,
      summary: "Could not classify email.",
    };
  }
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id }: EmailSyncRequest = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user's Google linked account
    const { data: linkedAccount, error: laError } = await supabase
      .from("linked_accounts")
      .select("*")
      .eq("user_id", user_id)
      .eq("provider", "google")
      .single();

    if (laError || !linkedAccount) {
      return new Response(
        JSON.stringify({ error: "No linked Google account found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let accessToken = linkedAccount.access_token;

    // Refresh token if expired
    if (
      linkedAccount.token_expires &&
      new Date(linkedAccount.token_expires) <= new Date()
    ) {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
          client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
          refresh_token: linkedAccount.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.access_token) {
        accessToken = tokenData.access_token;
        const expiresAt = new Date(
          Date.now() + tokenData.expires_in * 1000
        ).toISOString();

        await supabase
          .from("linked_accounts")
          .update({
            access_token: accessToken,
            token_expires: expiresAt,
          })
          .eq("id", linkedAccount.id);
      } else {
        return new Response(
          JSON.stringify({ error: "Failed to refresh Google token" }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Determine last sync time: most recent interaction from email channel
    const { data: lastInteraction } = await supabase
      .from("interactions")
      .select("occurred_at")
      .eq("user_id", user_id)
      .eq("channel", "email")
      .order("occurred_at", { ascending: false })
      .limit(1)
      .single();

    const sinceEpochMs = lastInteraction
      ? new Date(lastInteraction.occurred_at).getTime()
      : Date.now() - 7 * 24 * 60 * 60 * 1000; // Default: last 7 days

    // Fetch message list from Gmail
    const query = `after:${Math.floor(sinceEpochMs / 1000)}`;
    const listResponse = await fetch(
      `${GMAIL_API_BASE}/messages?q=${encodeURIComponent(query)}&maxResults=50`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const listData = await listResponse.json();
    const messageIds: string[] = (listData.messages || []).map(
      (m: { id: string }) => m.id
    );

    if (messageIds.length === 0) {
      return new Response(
        JSON.stringify({ synced: 0, actions_created: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch user's contacts for matching
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, email, full_name")
      .eq("user_id", user_id);

    const contactsByEmail = new Map(
      (contacts || [])
        .filter((c: { email: string | null }) => c.email)
        .map((c: { id: string; email: string; full_name: string }) => [
          c.email.toLowerCase(),
          c,
        ])
    );

    // Fetch user email for direction detection
    const { data: userData } = await supabase
      .from("users")
      .select("email")
      .eq("id", user_id)
      .single();

    const userEmail = userData?.email?.toLowerCase() ?? "";

    let synced = 0;
    let actionsCreated = 0;

    // Process each message
    for (const msgId of messageIds) {
      // Check if already imported
      const { data: existing } = await supabase
        .from("interactions")
        .select("id")
        .eq("message_id", msgId)
        .single();

      if (existing) continue;

      // Fetch full message
      const msgResponse = await fetch(
        `${GMAIL_API_BASE}/messages/${msgId}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const message: GmailMessage = await msgResponse.json();

      const headers = message.payload.headers;
      const from = getHeader(headers, "From") ?? "";
      const to = getHeader(headers, "To") ?? "";
      const subject = getHeader(headers, "Subject") ?? "(no subject)";
      const fromEmail = extractEmailAddress(from);
      const bodyText = getBodyText(message);
      const bodySnippet = bodyText.slice(0, 500);

      // Determine direction
      const direction = fromEmail === userEmail ? "outbound" : "inbound";

      // Match to contact
      const counterpartyEmail =
        direction === "inbound" ? fromEmail : extractEmailAddress(to);
      const matchedContact = contactsByEmail.get(counterpartyEmail);

      if (!matchedContact) {
        // Skip emails from/to unknown contacts
        continue;
      }

      // Classify with Haiku
      const classification = await classifyEmail(
        anthropicApiKey,
        subject,
        bodySnippet,
        from
      );

      // Create interaction
      const occurredAt = new Date(
        parseInt(message.internalDate)
      ).toISOString();

      await supabase.from("interactions").insert({
        user_id,
        contact_id: matchedContact.id,
        channel: "email",
        direction,
        subject,
        body_snippet: bodySnippet,
        sentiment: classification.sentiment,
        intent: classification.intent,
        thread_id: message.threadId,
        message_id: msgId,
        metadata: { classification },
        occurred_at: occurredAt,
      });

      synced++;

      // Update contact's last_interaction_at
      await supabase
        .from("contacts")
        .update({ last_interaction_at: occurredAt })
        .eq("id", matchedContact.id)
        .lt("last_interaction_at", occurredAt);

      // Create action card if reply is needed (inbound only)
      if (direction === "inbound" && classification.needs_reply) {
        await supabase.from("actions").insert({
          user_id,
          contact_id: matchedContact.id,
          type: "reply_draft",
          status: "pending",
          priority: classification.priority,
          title: `Reply to ${matchedContact.full_name}`,
          body: classification.summary,
          metadata: {
            thread_id: message.threadId,
            message_id: msgId,
            subject,
          },
        });
        actionsCreated++;
      }
    }

    // Log the sync operation
    await supabase.from("agent_logs").insert({
      user_id,
      action: "email_sync",
      model: HAIKU_MODEL,
      input_tokens: 0,
      output_tokens: 0,
      latency_ms: 0,
      request_body: { message_count: messageIds.length },
      response_body: { synced, actions_created: actionsCreated },
    });

    return new Response(
      JSON.stringify({
        synced,
        actions_created: actionsCreated,
        messages_checked: messageIds.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Email sync error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
