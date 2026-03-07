import type {
  Contact,
  Company,
  Interaction,
  PipelineItem,
  Pipeline,
} from '@mercury/shared';
import { aiGateway } from '../gateway';
import { dealScoringPrompt, candidateScoringPrompt } from '../prompts';

export interface DealScore {
  score: number;
  health: 'strong' | 'healthy' | 'at_risk' | 'stalled' | 'cold';
  riskFactors: string[];
  recommendedActions: string[];
  winProbability: number;
  estimatedDaysToClose: number | null;
  summary: string;
}

export interface CandidateScore {
  score: number;
  engagementLevel: 'highly_engaged' | 'engaged' | 'lukewarm' | 'disengaged' | 'ghosted';
  riskFactors: string[];
  recommendedActions: string[];
  responseLikelihood: number;
  estimatedDaysToDecision: number | null;
  summary: string;
}

export interface PipelineInsight {
  type: 'stalled' | 'hot_streak' | 'bottleneck' | 'risk' | 'opportunity';
  title: string;
  description: string;
  affectedItems: string[];
  suggestedAction: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * AnalystAgent scores deals and candidates, detects stalled pipelines,
 * and generates actionable insights from relationship data.
 */
export class AnalystAgent {
  /**
   * Score a deal in the sales pipeline.
   */
  async scoreDeal(
    contact: Contact,
    company: Company | null,
    pipelineItem: PipelineItem,
    interactions: Interaction[],
  ): Promise<DealScore> {
    const lastInteraction = interactions.sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    )[0];

    const daysSinceLastActivity = lastInteraction
      ? Math.floor(
          (Date.now() - new Date(lastInteraction.occurred_at).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 999;

    const lastSentiment = lastInteraction?.sentiment ?? 'neutral';

    const prompt = dealScoringPrompt(
      contact.full_name,
      company?.name ?? null,
      pipelineItem.stage,
      pipelineItem.value,
      daysSinceLastActivity,
      interactions.length,
      lastSentiment,
      pipelineItem.notes,
    );

    const response = await aiGateway({
      messages: [{ role: 'user', content: prompt }],
      system:
        'You are a sales analytics engine. Score deals accurately based on the data. Return ONLY valid JSON.',
      tier: 'fast',
      maxTokens: 1024,
      temperature: 0.3,
      agentType: 'analyst',
      action: 'score_deal',
    });

    try {
      const parsed = JSON.parse(response.content) as {
        score: number;
        health: DealScore['health'];
        risk_factors: string[];
        recommended_actions: string[];
        win_probability: number;
        estimated_days_to_close: number | null;
        summary: string;
      };

      return {
        score: parsed.score,
        health: parsed.health,
        riskFactors: parsed.risk_factors,
        recommendedActions: parsed.recommended_actions,
        winProbability: parsed.win_probability,
        estimatedDaysToClose: parsed.estimated_days_to_close,
        summary: parsed.summary,
      };
    } catch {
      return {
        score: 50,
        health: 'at_risk',
        riskFactors: ['Unable to analyze deal - insufficient data'],
        recommendedActions: ['Review deal manually'],
        winProbability: 0.5,
        estimatedDaysToClose: null,
        summary: 'Deal analysis unavailable.',
      };
    }
  }

  /**
   * Score a candidate in the recruiting pipeline.
   */
  async scoreCandidate(
    contact: Contact,
    company: Company | null,
    pipelineItem: PipelineItem,
    interactions: Interaction[],
  ): Promise<CandidateScore> {
    const lastInteraction = interactions.sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    )[0];

    const daysSinceLastActivity = lastInteraction
      ? Math.floor(
          (Date.now() - new Date(lastInteraction.occurred_at).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 999;

    const lastSentiment = lastInteraction?.sentiment ?? 'neutral';

    const prompt = candidateScoringPrompt(
      contact.full_name,
      contact.title,
      company?.name ?? null,
      pipelineItem.stage,
      daysSinceLastActivity,
      interactions.length,
      lastSentiment,
      pipelineItem.notes,
    );

    const response = await aiGateway({
      messages: [{ role: 'user', content: prompt }],
      system:
        'You are a recruiting analytics engine. Score candidate engagement accurately. Return ONLY valid JSON.',
      tier: 'fast',
      maxTokens: 1024,
      temperature: 0.3,
      agentType: 'analyst',
      action: 'score_candidate',
    });

    try {
      const parsed = JSON.parse(response.content) as {
        score: number;
        engagement_level: CandidateScore['engagementLevel'];
        risk_factors: string[];
        recommended_actions: string[];
        response_likelihood: number;
        estimated_days_to_decision: number | null;
        summary: string;
      };

      return {
        score: parsed.score,
        engagementLevel: parsed.engagement_level,
        riskFactors: parsed.risk_factors,
        recommendedActions: parsed.recommended_actions,
        responseLikelihood: parsed.response_likelihood,
        estimatedDaysToDecision: parsed.estimated_days_to_decision,
        summary: parsed.summary,
      };
    } catch {
      return {
        score: 50,
        engagementLevel: 'lukewarm',
        riskFactors: ['Unable to analyze candidate - insufficient data'],
        recommendedActions: ['Review candidate manually'],
        responseLikelihood: 0.5,
        estimatedDaysToDecision: null,
        summary: 'Candidate analysis unavailable.',
      };
    }
  }

  /**
   * Detect stalled items, bottlenecks, and generate pipeline insights.
   */
  async generatePipelineInsights(
    pipeline: Pipeline,
    items: PipelineItem[],
    contacts: Map<string, Contact>,
    interactions: Map<string, Interaction[]>,
  ): Promise<PipelineInsight[]> {
    const insights: PipelineInsight[] = [];
    const now = Date.now();

    // Detect stalled items (no activity for 7+ days)
    const stalledItems = items.filter((item) => {
      const contactInteractions = interactions.get(item.contact_id) ?? [];
      const lastActivity = contactInteractions.sort(
        (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
      )[0];
      if (!lastActivity) return true;
      const daysSince =
        (now - new Date(lastActivity.occurred_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 7;
    });

    if (stalledItems.length > 0) {
      insights.push({
        type: 'stalled',
        title: `${stalledItems.length} stalled ${pipeline.type === 'sales' ? 'deals' : 'candidates'}`,
        description: `${stalledItems.length} items have had no activity in the last 7 days.`,
        affectedItems: stalledItems.map((item) => {
          const contact = contacts.get(item.contact_id);
          return contact?.full_name ?? item.contact_id;
        }),
        suggestedAction: 'Review and re-engage or remove stalled items.',
        priority: stalledItems.length > 3 ? 'high' : 'medium',
      });
    }

    // Detect bottleneck stages (disproportionate number of items stuck)
    const stageCountMap = new Map<string, number>();
    for (const item of items) {
      stageCountMap.set(item.stage, (stageCountMap.get(item.stage) ?? 0) + 1);
    }
    const avgPerStage = items.length / pipeline.stages.length;
    for (const [stage, count] of stageCountMap) {
      if (count > avgPerStage * 2 && count > 3) {
        insights.push({
          type: 'bottleneck',
          title: `Bottleneck at "${stage}"`,
          description: `${count} items are in the "${stage}" stage, which is ${Math.round(count / avgPerStage)}x the average.`,
          affectedItems: items
            .filter((i) => i.stage === stage)
            .map((item) => {
              const contact = contacts.get(item.contact_id);
              return contact?.full_name ?? item.contact_id;
            }),
          suggestedAction: `Focus on moving items through "${stage}" or re-qualify them.`,
          priority: 'high',
        });
      }
    }

    // Detect hot streaks (multiple recent positive interactions)
    for (const item of items) {
      const contactInteractions = interactions.get(item.contact_id) ?? [];
      const recentPositive = contactInteractions.filter((i) => {
        const daysAgo = (now - new Date(i.occurred_at).getTime()) / (1000 * 60 * 60 * 24);
        return daysAgo < 7 && i.sentiment === 'positive';
      });
      if (recentPositive.length >= 3) {
        const contact = contacts.get(item.contact_id);
        insights.push({
          type: 'hot_streak',
          title: `${contact?.full_name ?? 'Contact'} is highly engaged`,
          description: `${recentPositive.length} positive interactions in the last 7 days. Strike while the iron is hot.`,
          affectedItems: [contact?.full_name ?? item.contact_id],
          suggestedAction: 'Consider advancing to the next stage or scheduling a meeting.',
          priority: 'high',
        });
      }
    }

    return insights;
  }
}
