import type { Contact, Interaction, Action, ActionType } from '@mercury/shared';
import { PACING_RULES } from '@mercury/shared';
import { aiGateway } from '../gateway';

export interface CadenceRecommendation {
  contactId: string;
  contactName: string;
  action: 'send_now' | 'wait' | 'skip' | 'escalate';
  reason: string;
  suggestedSendAt: Date | null;
  suggestedActionType: ActionType | null;
  nextFollowUpAt: Date | null;
}

export interface PacingStatus {
  contactId: string;
  emailsSentThisWeek: number;
  hoursSinceLastEmail: number;
  companyEmailsToday: number;
  isWithinLimits: boolean;
  violations: string[];
}

/**
 * CadenceAgent manages follow-up timing, enforces pacing rules,
 * and adapts outreach cadence based on engagement signals.
 */
export class CadenceAgent {
  /**
   * Check if sending to a contact is within pacing limits.
   */
  checkPacing(
    contactId: string,
    companyId: string | null,
    recentInteractions: Interaction[],
    allCompanyInteractions: Interaction[],
  ): PacingStatus {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Count emails sent to this contact in the last week
    const contactEmails = recentInteractions.filter(
      (i) =>
        i.type === 'email_sent' &&
        new Date(i.occurred_at) >= oneWeekAgo,
    );
    const emailsSentThisWeek = contactEmails.length;

    // Hours since last email to this contact
    const lastEmail = contactEmails.sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    )[0];
    const hoursSinceLastEmail = lastEmail
      ? (now.getTime() - new Date(lastEmail.occurred_at).getTime()) / (1000 * 60 * 60)
      : Infinity;

    // Count emails to this company today
    const companyEmailsToday = allCompanyInteractions.filter(
      (i) =>
        i.type === 'email_sent' &&
        new Date(i.occurred_at) >= todayStart,
    ).length;

    const violations: string[] = [];

    if (emailsSentThisWeek >= PACING_RULES.max_emails_per_contact_per_week) {
      violations.push(
        `Exceeded ${PACING_RULES.max_emails_per_contact_per_week} emails/week to this contact`,
      );
    }
    if (hoursSinceLastEmail < PACING_RULES.min_hours_between_emails) {
      violations.push(
        `Only ${Math.round(hoursSinceLastEmail)}h since last email (min: ${PACING_RULES.min_hours_between_emails}h)`,
      );
    }
    if (companyEmailsToday >= PACING_RULES.max_emails_per_company_per_day) {
      violations.push(
        `Exceeded ${PACING_RULES.max_emails_per_company_per_day} emails/day to this company`,
      );
    }

    return {
      contactId,
      emailsSentThisWeek,
      hoursSinceLastEmail: Math.round(hoursSinceLastEmail * 10) / 10,
      companyEmailsToday,
      isWithinLimits: violations.length === 0,
      violations,
    };
  }

  /**
   * Get follow-up recommendations for a set of contacts based on
   * their interaction history and engagement signals.
   */
  async getRecommendations(
    contacts: Contact[],
    interactionsByContact: Map<string, Interaction[]>,
    existingActions: Action[],
  ): Promise<CadenceRecommendation[]> {
    const recommendations: CadenceRecommendation[] = [];

    for (const contact of contacts) {
      const interactions = interactionsByContact.get(contact.id) ?? [];
      const hasOpenAction = existingActions.some(
        (a) => a.contact_id === contact.id && a.status === 'pending',
      );

      if (hasOpenAction) {
        continue; // Skip contacts that already have pending actions
      }

      const recommendation = await this.analyzeContactCadence(
        contact,
        interactions,
      );
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    // Sort by urgency: send_now first, then escalate, then wait
    const actionPriority: Record<string, number> = {
      send_now: 0,
      escalate: 1,
      wait: 2,
      skip: 3,
    };
    recommendations.sort(
      (a, b) => (actionPriority[a.action] ?? 3) - (actionPriority[b.action] ?? 3),
    );

    return recommendations;
  }

  /**
   * Analyze a single contact's cadence and determine next action.
   */
  private async analyzeContactCadence(
    contact: Contact,
    interactions: Interaction[],
  ): Promise<CadenceRecommendation | null> {
    if (interactions.length === 0) {
      return {
        contactId: contact.id,
        contactName: contact.full_name,
        action: 'send_now',
        reason: 'No prior interactions. Time for initial outreach.',
        suggestedSendAt: new Date(),
        suggestedActionType: 'follow_up' as ActionType,
        nextFollowUpAt: null,
      };
    }

    const lastInteraction = interactions.sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    )[0];

    const daysSinceLast = Math.floor(
      (new Date().getTime() - new Date(lastInteraction.occurred_at).getTime()) /
        (1000 * 60 * 60 * 24),
    );

    // Use AI for nuanced analysis of engagement patterns
    const interactionSummary = interactions
      .slice(0, 10)
      .map(
        (i) =>
          `[${i.type}] ${new Date(i.occurred_at).toLocaleDateString()}: ${i.sentiment ?? 'unknown'} sentiment`,
      )
      .join('\n');

    const response = await aiGateway({
      messages: [
        {
          role: 'user',
          content: `Analyze this contact's engagement and recommend next action.

Contact: ${contact.full_name} (${contact.segment})
Days since last interaction: ${daysSinceLast}
Total interactions: ${interactions.length}

Recent interactions:
${interactionSummary}

Return JSON: { "action": "send_now"|"wait"|"skip"|"escalate", "reason": "...", "wait_days": <number or null>, "suggested_action_type": "follow_up"|"reply_needed"|"deal_cold"|null }`,
        },
      ],
      system:
        'You are a sales cadence optimizer. Analyze engagement patterns and recommend timing. Return ONLY valid JSON.',
      tier: 'fast',
      maxTokens: 512,
      temperature: 0.3,
      agentType: 'cadence',
      action: 'analyze_cadence',
    });

    try {
      const analysis = JSON.parse(response.content) as {
        action: 'send_now' | 'wait' | 'skip' | 'escalate';
        reason: string;
        wait_days: number | null;
        suggested_action_type: ActionType | null;
      };

      const suggestedSendAt =
        analysis.action === 'wait' && analysis.wait_days
          ? new Date(Date.now() + analysis.wait_days * 24 * 60 * 60 * 1000)
          : analysis.action === 'send_now'
            ? new Date()
            : null;

      return {
        contactId: contact.id,
        contactName: contact.full_name,
        action: analysis.action,
        reason: analysis.reason,
        suggestedSendAt,
        suggestedActionType: analysis.suggested_action_type,
        nextFollowUpAt: suggestedSendAt,
      };
    } catch {
      return null;
    }
  }

  /**
   * Calculate the optimal send time based on past engagement patterns.
   */
  getOptimalSendTime(interactions: Interaction[]): Date {
    const receivedInteractions = interactions.filter(
      (i) => i.type === 'email_received' || i.type === 'sms_received',
    );

    if (receivedInteractions.length < 3) {
      // Default: next business day at 9 AM
      const now = new Date();
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      // Skip weekends
      while (next.getDay() === 0 || next.getDay() === 6) {
        next.setDate(next.getDate() + 1);
      }
      next.setHours(9, 0, 0, 0);
      return next;
    }

    // Find the most common hour when they respond
    const hourCounts = new Map<number, number>();
    for (const interaction of receivedInteractions) {
      const hour = new Date(interaction.occurred_at).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
    }

    let bestHour = 9;
    let maxCount = 0;
    for (const [hour, count] of hourCounts) {
      if (count > maxCount) {
        maxCount = count;
        bestHour = hour;
      }
    }

    // Send 1 hour before their most active time
    const sendHour = Math.max(7, bestHour - 1);
    const next = new Date();
    next.setDate(next.getDate() + 1);
    while (next.getDay() === 0 || next.getDay() === 6) {
      next.setDate(next.getDate() + 1);
    }
    next.setHours(sendHour, 0, 0, 0);
    return next;
  }
}
