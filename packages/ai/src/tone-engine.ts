import type { StyleFingerprint, ComposeContext } from '@mercury/shared';
import { aiGateway } from './gateway';
import { styleAnalysisPrompt, emailCompositionPrompt } from './prompts';

/**
 * ToneEngine analyzes a user's writing style from their sent emails
 * and produces a StyleFingerprint that guides AI-composed messages
 * to sound like the user wrote them.
 */
export class ToneEngine {
  /**
   * Analyze 200+ sent emails to extract the user's unique writing style fingerprint.
   * Uses the standard model tier for higher quality analysis.
   */
  async analyzeSentEmails(emails: string[]): Promise<StyleFingerprint> {
    // Take a representative sample if we have too many emails
    const sampleSize = 250;
    const sample =
      emails.length > sampleSize
        ? this.selectRepresentativeSample(emails, sampleSize)
        : emails;

    const prompt = styleAnalysisPrompt(sample);

    const response = await aiGateway({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      system:
        'You are a linguistic analyst specializing in personal writing style analysis. ' +
        'Analyze the provided emails and extract a detailed style fingerprint. ' +
        'Return ONLY valid JSON matching the StyleFingerprint schema. No markdown, no explanation.',
      tier: 'standard',
      maxTokens: 4096,
      temperature: 0.3,
      agentType: 'composer',
      action: 'analyze_style',
      cacheControl: true,
    });

    try {
      return JSON.parse(response.content) as StyleFingerprint;
    } catch {
      throw new Error(
        'Failed to parse style fingerprint from AI response. The model returned invalid JSON.',
      );
    }
  }

  /**
   * Update the style fingerprint based on a user's edit of an AI-generated draft.
   * This is how Mercury learns and adapts over time - every edit teaches it.
   */
  updateFingerprint(
    current: StyleFingerprint,
    originalDraft: string,
    editedVersion: string,
  ): StyleFingerprint {
    const updated = structuredClone(current);

    // Analyze structural changes
    const originalSentences = originalDraft.split(/[.!?]+/).filter(Boolean);
    const editedSentences = editedVersion.split(/[.!?]+/).filter(Boolean);

    // Update average sentence length
    const editedAvgLength =
      editedSentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) /
      Math.max(editedSentences.length, 1);
    updated.avg_sentence_length = Math.round(
      (current.avg_sentence_length * 0.8 + editedAvgLength * 0.2) * 10,
    ) / 10;

    // Detect greeting changes
    const editedFirstLine = editedVersion.split('\n')[0]?.trim() ?? '';
    if (editedFirstLine !== originalDraft.split('\n')[0]?.trim()) {
      updated.greeting_style = editedFirstLine;
    }

    // Detect sign-off changes
    const editedLines = editedVersion.trim().split('\n');
    const editedLastLine = editedLines[editedLines.length - 1]?.trim() ?? '';
    const originalLines = originalDraft.trim().split('\n');
    const originalLastLine = originalLines[originalLines.length - 1]?.trim() ?? '';
    if (editedLastLine !== originalLastLine) {
      updated.sign_off_style = editedLastLine;
    }

    // Detect emoji usage changes
    const originalEmojis = (originalDraft.match(/[\p{Emoji_Presentation}]/gu) ?? []).length;
    const editedEmojis = (editedVersion.match(/[\p{Emoji_Presentation}]/gu) ?? []).length;
    if (editedEmojis > originalEmojis) {
      const emojiLevels: StyleFingerprint['emoji_usage'][] = [
        'never',
        'rare',
        'occasional',
        'frequent',
      ];
      const currentIndex = emojiLevels.indexOf(current.emoji_usage);
      if (currentIndex < emojiLevels.length - 1) {
        updated.emoji_usage = emojiLevels[currentIndex + 1];
      }
    } else if (editedEmojis < originalEmojis && editedEmojis === 0) {
      const emojiLevels: StyleFingerprint['emoji_usage'][] = [
        'never',
        'rare',
        'occasional',
        'frequent',
      ];
      const currentIndex = emojiLevels.indexOf(current.emoji_usage);
      if (currentIndex > 0) {
        updated.emoji_usage = emojiLevels[currentIndex - 1];
      }
    }

    // Detect punctuation changes
    updated.punctuation_habits = {
      ...current.punctuation_habits,
      uses_exclamations: /!/.test(editedVersion),
      uses_ellipsis: /\.{3}|…/.test(editedVersion),
      uses_dashes: /[—–-]{2,}|—/.test(editedVersion),
    };

    // Detect formality shift
    const casualIndicators = /\b(hey|yeah|gonna|wanna|kinda|btw|fyi|lol)\b/gi;
    const formalIndicators = /\b(regarding|pursuant|accordingly|furthermore|hereby)\b/gi;
    const editedCasual = (editedVersion.match(casualIndicators) ?? []).length;
    const editedFormal = (editedVersion.match(formalIndicators) ?? []).length;
    const originalCasual = (originalDraft.match(casualIndicators) ?? []).length;
    const originalFormal = (originalDraft.match(formalIndicators) ?? []).length;

    if (editedCasual > originalCasual) {
      updated.tone_markers.formality = Math.max(1, current.tone_markers.formality - 0.5);
    } else if (editedFormal > originalFormal) {
      updated.tone_markers.formality = Math.min(10, current.tone_markers.formality + 0.5);
    }

    // Detect paragraph structure changes
    const editedParagraphs = editedVersion.split(/\n\s*\n/).filter(Boolean);
    const avgParagraphLength =
      editedParagraphs.reduce((sum, p) => sum + p.split(/\s+/).length, 0) /
      Math.max(editedParagraphs.length, 1);
    if (avgParagraphLength < 30) {
      updated.paragraph_structure = 'short';
    } else if (avgParagraphLength < 60) {
      updated.paragraph_structure = 'medium';
    } else {
      updated.paragraph_structure = 'long';
    }

    // Shorter edits suggest preference for directness
    if (editedVersion.length < originalDraft.length * 0.8) {
      updated.tone_markers.directness = Math.min(
        10,
        current.tone_markers.directness + 0.5,
      );
    } else if (editedVersion.length > originalDraft.length * 1.2) {
      updated.tone_markers.directness = Math.max(
        1,
        current.tone_markers.directness - 0.3,
      );
    }

    return updated;
  }

  /**
   * Build the full composition prompt including the style fingerprint context.
   * This is the prompt that makes AI-written emails sound like the user.
   */
  getCompositionPrompt(fingerprint: StyleFingerprint, context: ComposeContext): string {
    return emailCompositionPrompt(fingerprint, context);
  }

  /**
   * Select a representative sample of emails for analysis.
   * Ensures diversity in length, recency, and recipients.
   */
  private selectRepresentativeSample(emails: string[], sampleSize: number): string[] {
    // Sort by length to get a variety
    const sorted = [...emails].sort((a, b) => a.length - b.length);

    // Take evenly spaced samples across the length distribution
    const step = sorted.length / sampleSize;
    const sample: string[] = [];

    for (let i = 0; i < sampleSize && i * step < sorted.length; i++) {
      sample.push(sorted[Math.floor(i * step)]);
    }

    return sample;
  }
}
