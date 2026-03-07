// Mercury AI Gateway – Supabase Edge Function
// Routes requests to Claude models, handles streaming, and logs token usage.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

const MODEL_MAP: Record<string, string> = {
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5-20251001",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GatewayRequest {
  model: "sonnet" | "haiku";
  messages: Array<{ role: string; content: string }>;
  system?: string;
  stream?: boolean;
  max_tokens?: number;
}

serve(async (req: Request) => {
  // Handle CORS preflight
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
    // Authenticate the caller via Supabase JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY")!;

    // Create a client with the user's JWT to extract user_id
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client for logging
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body: GatewayRequest = await req.json();

    // Validate model
    const modelId = MODEL_MAP[body.model];
    if (!modelId) {
      return new Response(
        JSON.stringify({
          error: `Invalid model. Must be one of: ${Object.keys(MODEL_MAP).join(", ")}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const anthropicBody: Record<string, unknown> = {
      model: modelId,
      max_tokens: body.max_tokens ?? 4096,
      messages: body.messages,
    };
    if (body.system) {
      anthropicBody.system = body.system;
    }
    if (body.stream) {
      anthropicBody.stream = true;
    }

    const startMs = Date.now();

    const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(anthropicBody),
    });

    // ---------- Streaming ----------
    if (body.stream) {
      // Pass the SSE stream through to the client
      const readable = anthropicResponse.body;
      if (!readable) {
        throw new Error("No response body from Anthropic");
      }

      // We need to tee the stream: one for the client, one for logging
      const [clientStream, logStream] = readable.tee();

      // Log asynchronously after streaming completes
      (async () => {
        try {
          const reader = logStream.getReader();
          const decoder = new TextDecoder();
          let fullText = "";
          let inputTokens = 0;
          let outputTokens = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const event = JSON.parse(data);

                if (event.type === "content_block_delta" && event.delta?.text) {
                  fullText += event.delta.text;
                }

                if (event.type === "message_delta" && event.usage) {
                  outputTokens = event.usage.output_tokens ?? outputTokens;
                }

                if (event.type === "message_start" && event.message?.usage) {
                  inputTokens = event.message.usage.input_tokens ?? 0;
                }
              } catch {
                // Skip non-JSON lines
              }
            }
          }

          const latencyMs = Date.now() - startMs;
          await supabaseAdmin.from("agent_logs").insert({
            user_id: user.id,
            action: "ai_gateway_stream",
            model: modelId,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            latency_ms: latencyMs,
            request_body: { model: body.model, message_count: body.messages.length },
            response_body: { text_length: fullText.length },
          });
        } catch (logErr) {
          console.error("Failed to log streaming usage:", logErr);
        }
      })();

      return new Response(clientStream, {
        status: anthropicResponse.status,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // ---------- Non-streaming ----------
    const latencyMs = Date.now() - startMs;
    const responseJson = await anthropicResponse.json();

    if (!anthropicResponse.ok) {
      // Log error
      await supabaseAdmin.from("agent_logs").insert({
        user_id: user.id,
        action: "ai_gateway",
        model: modelId,
        input_tokens: 0,
        output_tokens: 0,
        latency_ms: latencyMs,
        request_body: { model: body.model, message_count: body.messages.length },
        error: JSON.stringify(responseJson),
      });

      return new Response(JSON.stringify({ error: responseJson }), {
        status: anthropicResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log successful call
    const inputTokens = responseJson.usage?.input_tokens ?? 0;
    const outputTokens = responseJson.usage?.output_tokens ?? 0;

    await supabaseAdmin.from("agent_logs").insert({
      user_id: user.id,
      action: "ai_gateway",
      model: modelId,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      latency_ms: latencyMs,
      request_body: { model: body.model, message_count: body.messages.length },
      response_body: {
        id: responseJson.id,
        stop_reason: responseJson.stop_reason,
      },
    });

    return new Response(JSON.stringify(responseJson), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("AI Gateway error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
