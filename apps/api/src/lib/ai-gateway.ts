import Anthropic from '@anthropic-ai/sdk';
import { getServiceClient } from './supabase.js';
// ─── Types ──────────────────────────────────────────────────────────────────

type ModelAlias = 'sonnet' | 'haiku';

interface AIGatewayOptions {
  model: ModelAlias;
  messages: Anthropic.MessageParam[];
  system?: string;
  stream?: boolean;
  userId?: string;
  agentType?: string;
  maxTokens?: number;
}

interface AIGatewayResponse {
  content: string;
  tokensUsed: { input: number; output: number };
  model: string;
  costCents: number;
  durationMs: number;
}

// ─── Model mapping ──────────────────────────────────────────────────────────

const MODEL_MAP: Record<ModelAlias, string> = {
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5-20251001',
};

// Approximate cost per 1K tokens (in cents)
const COST_PER_1K: Record<ModelAlias, { input: number; output: number }> = {
  sonnet: { input: 0.3, output: 1.5 },
  haiku: { input: 0.025, output: 0.125 },
};

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ─── Client ─────────────────────────────────────────────────────────────────

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }
  return _client;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function calculateCost(
  model: ModelAlias,
  inputTokens: number,
  outputTokens: number
): number {
  const rates = COST_PER_1K[model];
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function logToAgentLogs(
  userId: string | undefined,
  agentType: string | undefined,
  model: string,
  tokensUsed: { input: number; output: number },
  costCents: number,
  durationMs: number,
  error: string | null
): Promise<void> {
  try {
    const supabase = getServiceClient();
    await supabase.from('agent_logs').insert({
      user_id: userId,
      agent_type: agentType ?? 'orchestrator',
      action: 'ai_gateway_call',
      input: null,
      output: null,
      tokens_used: tokensUsed.input + tokensUsed.output,
      model,
      cost_cents: costCents,
      duration_ms: durationMs,
      error,
    });
  } catch (logError) {
    console.error('[ai-gateway] Failed to log to agent_logs:', logError);
  }
}

// ─── Gateway ────────────────────────────────────────────────────────────────

/**
 * AI Gateway -- the single entry point for ALL AI calls in Mercury.
 * Routes to the correct Claude model, handles retries, tracks cost, and logs usage.
 */
export async function aiGateway(options: AIGatewayOptions): Promise<AIGatewayResponse> {
  const {
    model: modelAlias,
    messages,
    system,
    userId,
    agentType,
    maxTokens = 4096,
  } = options;

  const modelId = MODEL_MAP[modelAlias];
  const client = getClient();

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const startTime = Date.now();

    try {
      const response = await client.messages.create({
        model: modelId,
        max_tokens: maxTokens,
        system: system ?? undefined,
        messages,
      });

      const durationMs = Date.now() - startTime;
      const tokensUsed = {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      };
      const costCents = calculateCost(modelAlias, tokensUsed.input, tokensUsed.output);

      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      // Log in background -- don't block the response
      logToAgentLogs(userId, agentType, modelId, tokensUsed, costCents, durationMs, null);

      return {
        content: textContent,
        tokensUsed,
        model: modelId,
        costCents,
        durationMs,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const durationMs = Date.now() - startTime;

      console.error(
        `[ai-gateway] Attempt ${attempt}/${MAX_RETRIES} failed for ${modelId}:`,
        lastError.message
      );

      // Log the error
      logToAgentLogs(
        userId,
        agentType,
        modelId,
        { input: 0, output: 0 },
        0,
        durationMs,
        lastError.message
      );

      // Don't retry on auth errors or invalid requests
      if (
        lastError.message.includes('401') ||
        lastError.message.includes('invalid_api_key') ||
        lastError.message.includes('400')
      ) {
        break;
      }

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw new Error(`AI Gateway failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

/**
 * Streaming AI Gateway -- returns an async generator of text chunks for SSE.
 */
export async function* aiGatewayStream(
  options: Omit<AIGatewayOptions, 'stream'>
): AsyncGenerator<string, void, undefined> {
  const {
    model: modelAlias,
    messages,
    system,
    userId,
    agentType,
    maxTokens = 4096,
  } = options;

  const modelId = MODEL_MAP[modelAlias];
  const client = getClient();
  const startTime = Date.now();

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    const stream = client.messages.stream({
      model: modelId,
      max_tokens: maxTokens,
      system: system ?? undefined,
      messages,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }

    const finalMessage = await stream.finalMessage();
    totalInputTokens = finalMessage.usage.input_tokens;
    totalOutputTokens = finalMessage.usage.output_tokens;

    const durationMs = Date.now() - startTime;
    const costCents = calculateCost(modelAlias, totalInputTokens, totalOutputTokens);

    logToAgentLogs(
      userId,
      agentType,
      modelId,
      { input: totalInputTokens, output: totalOutputTokens },
      costCents,
      durationMs,
      null
    );
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logToAgentLogs(
      userId,
      agentType,
      modelId,
      { input: totalInputTokens, output: totalOutputTokens },
      0,
      durationMs,
      errorMessage
    );

    throw error;
  }
}
