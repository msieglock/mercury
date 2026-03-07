import Anthropic from '@anthropic-ai/sdk';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ModelTier = 'standard' | 'fast';

export interface GatewayRequest {
  /** The prompt or messages to send */
  messages: Anthropic.MessageCreateParams['messages'];
  /** System prompt */
  system?: string;
  /** Model tier: 'standard' uses sonnet-4-6, 'fast' uses haiku-4-5 */
  tier?: ModelTier;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature (0-1) */
  temperature?: number;
  /** Whether to stream the response */
  stream?: boolean;
  /** User ID for cost attribution */
  userId?: string;
  /** Agent making the request (for logging) */
  agentType?: string;
  /** Action description (for logging) */
  action?: string;
  /** Enable prompt caching for repeated system prompts */
  cacheControl?: boolean;
}

export interface GatewayResponse {
  content: string;
  model: string;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
    cacheRead: number;
    cacheCreation: number;
  };
  costCents: number;
  durationMs: number;
  stopReason: string | null;
}

export interface GatewayStreamChunk {
  type: 'text' | 'done';
  text?: string;
  response?: GatewayResponse;
}

// ─── Model Configuration ─────────────────────────────────────────────────────

const MODEL_MAP: Record<ModelTier, string> = {
  standard: 'claude-sonnet-4-6-20250514',
  fast: 'claude-haiku-4-5-20250414',
};

// Pricing per million tokens (in cents)
const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  'claude-sonnet-4-6-20250514': {
    input: 300,
    output: 1500,
    cacheRead: 30,
    cacheWrite: 375,
  },
  'claude-haiku-4-5-20250414': {
    input: 80,
    output: 400,
    cacheRead: 8,
    cacheWrite: 100,
  },
};

// ─── Singleton Client ────────────────────────────────────────────────────────

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

// ─── Cost Calculation ────────────────────────────────────────────────────────

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheCreationTokens: number,
): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const cacheReadCost = (cacheReadTokens / 1_000_000) * pricing.cacheRead;
  const cacheWriteCost = (cacheCreationTokens / 1_000_000) * pricing.cacheWrite;

  return Math.round((inputCost + outputCost + cacheReadCost + cacheWriteCost) * 100) / 100;
}

// ─── Gateway Function ────────────────────────────────────────────────────────

/**
 * Single entry point for ALL AI calls in Mercury.
 *
 * Handles model routing, prompt caching, token counting, cost attribution,
 * error handling, and streaming support.
 */
export async function aiGateway(request: GatewayRequest): Promise<GatewayResponse> {
  const anthropic = getClient();
  const model = MODEL_MAP[request.tier ?? 'standard'];
  const startTime = Date.now();

  try {
    const systemContent = request.system
      ? request.cacheControl
        ? [
            {
              type: 'text' as const,
              text: request.system,
              cache_control: { type: 'ephemeral' as const },
            },
          ]
        : request.system
      : undefined;

    const response = await anthropic.messages.create({
      model,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
      system: systemContent,
      messages: request.messages,
    });

    const durationMs = Date.now() - startTime;

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const cacheRead = (response.usage as unknown as Record<string, number>).cache_read_input_tokens ?? 0;
    const cacheCreation = (response.usage as unknown as Record<string, number>).cache_creation_input_tokens ?? 0;

    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      content,
      model,
      tokensUsed: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
        cacheRead,
        cacheCreation,
      },
      costCents: calculateCost(model, inputTokens, outputTokens, cacheRead, cacheCreation),
      durationMs,
      stopReason: response.stop_reason,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;

    if (error instanceof Anthropic.APIError) {
      throw new GatewayError(
        `AI API error (${error.status}): ${error.message}`,
        error.status,
        durationMs,
        request.agentType,
        request.action,
      );
    }

    throw new GatewayError(
      `AI gateway error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      durationMs,
      request.agentType,
      request.action,
    );
  }
}

/**
 * Stream AI responses for real-time UI updates.
 */
export async function* aiGatewayStream(
  request: GatewayRequest,
): AsyncGenerator<GatewayStreamChunk> {
  const anthropic = getClient();
  const model = MODEL_MAP[request.tier ?? 'standard'];
  const startTime = Date.now();

  const systemContent = request.system
    ? request.cacheControl
      ? [
          {
            type: 'text' as const,
            text: request.system,
            cache_control: { type: 'ephemeral' as const },
          },
        ]
      : request.system
    : undefined;

  const stream = anthropic.messages.stream({
    model,
    max_tokens: request.maxTokens ?? 4096,
    temperature: request.temperature ?? 0.7,
    system: systemContent,
    messages: request.messages,
  });

  let fullText = '';

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      fullText += event.delta.text;
      yield { type: 'text', text: event.delta.text };
    }
  }

  const finalMessage = await stream.finalMessage();
  const durationMs = Date.now() - startTime;

  const inputTokens = finalMessage.usage.input_tokens;
  const outputTokens = finalMessage.usage.output_tokens;
  const cacheRead = (finalMessage.usage as unknown as Record<string, number>).cache_read_input_tokens ?? 0;
  const cacheCreation = (finalMessage.usage as unknown as Record<string, number>).cache_creation_input_tokens ?? 0;

  yield {
    type: 'done',
    response: {
      content: fullText,
      model,
      tokensUsed: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
        cacheRead,
        cacheCreation,
      },
      costCents: calculateCost(model, inputTokens, outputTokens, cacheRead, cacheCreation),
      durationMs,
      stopReason: finalMessage.stop_reason,
    },
  };
}

// ─── Error Class ─────────────────────────────────────────────────────────────

export class GatewayError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly durationMs: number,
    public readonly agentType?: string,
    public readonly action?: string,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}
