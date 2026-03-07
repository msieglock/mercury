import {
  UserMode,
  type StyleFingerprint,
  type ComposeRequest,
  type ComposeResponse,
  type ComposeContext,
  type Contact,
  type Company,
  type Interaction,
  type OutreachPath,
} from '@mercury/shared';
import { aiGateway, aiGatewayStream, type GatewayStreamChunk } from '../gateway';
import { ToneEngine } from '../tone-engine';

/**
 * ComposerAgent drafts emails, SMS messages, and LinkedIn messages
 * that match the user's writing style using the ToneEngine.
 */
export class ComposerAgent {
  private toneEngine: ToneEngine;

  constructor() {
    this.toneEngine = new ToneEngine();
  }

  /**
   * Compose a message matching the user's style.
   */
  async compose(
    request: ComposeRequest,
    contact: Contact,
    company: Company | null,
    recentInteractions: Interaction[],
  ): Promise<ComposeResponse> {
    const context: ComposeContext = {
      contact,
      company,
      recent_interactions: recentInteractions,
      outreach_path: request.outreach_path,
      intent: request.intent,
      user_mode: UserMode.sales,
      additional_context: request.context ?? undefined,
    };

    const systemPrompt = request.style_fingerprint
      ? this.toneEngine.getCompositionPrompt(request.style_fingerprint, context)
      : this.buildFallbackPrompt(context);

    const channelInstruction = this.getChannelInstruction(request.outreach_path);

    const response = await aiGateway({
      messages: [
        {
          role: 'user',
          content: `${channelInstruction}\n\nCompose the message now.`,
        },
      ],
      system: systemPrompt,
      tier: 'standard',
      maxTokens: 2048,
      temperature: 0.7,
      agentType: 'composer',
      action: 'compose',
      cacheControl: true,
    });

    // Extract subject line if present (first line starting with "Subject:")
    let subject: string | null = null;
    let body = response.content;

    const subjectMatch = body.match(/^Subject:\s*(.+)\n/);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      body = body.slice(subjectMatch[0].length).trim();
    }

    return {
      subject,
      body,
      confidence: 0.85,
      suggestions: [],
      tokens_used: response.tokensUsed.total,
      model: response.model,
    };
  }

  /**
   * Stream a composed message for real-time display in the UI.
   */
  async *composeStream(
    request: ComposeRequest,
    contact: Contact,
    company: Company | null,
    recentInteractions: Interaction[],
  ): AsyncGenerator<GatewayStreamChunk> {
    const context: ComposeContext = {
      contact,
      company,
      recent_interactions: recentInteractions,
      outreach_path: request.outreach_path,
      intent: request.intent,
      user_mode: UserMode.sales,
      additional_context: request.context ?? undefined,
    };

    const systemPrompt = request.style_fingerprint
      ? this.toneEngine.getCompositionPrompt(request.style_fingerprint, context)
      : this.buildFallbackPrompt(context);

    const channelInstruction = this.getChannelInstruction(request.outreach_path);

    yield* aiGatewayStream({
      messages: [
        {
          role: 'user',
          content: `${channelInstruction}\n\nCompose the message now.`,
        },
      ],
      system: systemPrompt,
      tier: 'standard',
      maxTokens: 2048,
      temperature: 0.7,
      agentType: 'composer',
      action: 'compose_stream',
      cacheControl: true,
    });
  }

  /**
   * Generate alternative versions of a composed message.
   */
  async generateAlternatives(
    original: string,
    fingerprint: StyleFingerprint | null,
    count: number = 2,
  ): Promise<string[]> {
    const response = await aiGateway({
      messages: [
        {
          role: 'user',
          content: `Here is an email draft:\n\n${original}\n\nGenerate ${count} alternative versions. Each should convey the same message but with different angles or approaches. Keep the same tone and style.\n\nSeparate each alternative with "---ALTERNATIVE---"`,
        },
      ],
      system: fingerprint
        ? `Match this writing style: formality=${fingerprint.tone_markers.formality}/10, warmth=${fingerprint.tone_markers.warmth}/10, vocabulary=${fingerprint.vocabulary_level}. Return ONLY the alternative email bodies.`
        : 'Write professional, warm emails. Return ONLY the alternative email bodies.',
      tier: 'fast',
      maxTokens: 2048,
      temperature: 0.8,
      agentType: 'composer',
      action: 'alternatives',
    });

    return response.content
      .split('---ALTERNATIVE---')
      .map((alt) => alt.trim())
      .filter(Boolean);
  }

  /**
   * Get channel-specific composition instructions.
   */
  private getChannelInstruction(outreachPath: OutreachPath): string {
    switch (outreachPath) {
      case 'direct_text':
        return 'This is for SMS/text message. Keep it under 160 characters if possible. Be casual and concise. No subject line needed.';
      case 'direct_linkedin':
        return 'This is a LinkedIn message. Keep it professional but personable. Reference shared connections or interests. Under 300 characters for connection requests.';
      case 'warm_intro':
        return 'This is a warm introduction request. The email should be easy for the introducer to forward. Include a brief, compelling reason for the intro.';
      case 'cold_enriched':
        return 'This is cold outreach with enriched data. Lead with a personalized observation. Keep it under 150 words. Include a clear, low-friction CTA.';
      case 'cold_research':
        return 'This is researched cold outreach. Reference specific, relevant findings about the recipient or their company. Keep it concise and genuine.';
      case 'second_degree':
        return 'This reaches out through a shared community or connection. Reference the shared context naturally.';
      default:
        return 'This is a direct email. Write naturally and match the user\'s typical email style.';
    }
  }

  /**
   * Build a fallback prompt when no style fingerprint is available.
   */
  private buildFallbackPrompt(context: ComposeContext): string {
    return `You are composing a ${context.outreach_path} message to ${context.contact.full_name}${context.contact.title ? ` (${context.contact.title})` : ''}${context.company ? ` at ${context.company.name}` : ''}.

Intent: ${context.intent}
Mode: ${context.user_mode}
${context.additional_context ? `Context: ${context.additional_context}` : ''}

Write a professional, warm, and concise message. Sound human, not like AI.
Return ONLY the message text.`;
  }
}
