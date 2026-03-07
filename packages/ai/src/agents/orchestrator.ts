import type { AgentType } from '@mercury/shared';
import { aiGateway } from '../gateway';

export interface OrchestratorCommand {
  intent: string;
  targetAgent: AgentType;
  action: string;
  parameters: Record<string, unknown>;
  confidence: number;
}

export interface OrchestratorPlan {
  steps: OrchestratorStep[];
  summary: string;
  estimatedDuration: string;
}

export interface OrchestratorStep {
  order: number;
  agent: AgentType;
  action: string;
  description: string;
  parameters: Record<string, unknown>;
  dependsOn: number[];
}

/**
 * OrchestratorAgent processes natural language commands from the user
 * and coordinates the other agents to fulfill complex requests.
 *
 * This is the "brain" that turns "Draft a follow-up to Sarah about the Q3 proposal"
 * into a series of agent actions.
 */
export class OrchestratorAgent {
  /**
   * Parse a natural language command into structured agent actions.
   */
  async parseCommand(
    userInput: string,
    availableContacts?: string[],
    userMode?: string,
  ): Promise<OrchestratorCommand> {
    const contactContext = availableContacts
      ? `\nKnown contacts: ${availableContacts.slice(0, 20).join(', ')}`
      : '';

    const response = await aiGateway({
      messages: [
        {
          role: 'user',
          content: `Parse this command: "${userInput}"${contactContext}\n\nUser mode: ${userMode ?? 'sales'}`,
        },
      ],
      system: `You are a command parser for a CRM system. Parse natural language commands into structured actions.

Available agents:
- scout: Research prospects, find similar contacts, map org charts
- composer: Draft emails, SMS, LinkedIn messages
- cadence: Manage follow-up timing, check pacing
- analyst: Score deals/candidates, analyze pipelines
- orchestrator: Multi-step coordination

Return ONLY valid JSON:
{
  "intent": "brief description of what user wants",
  "targetAgent": "scout" | "composer" | "cadence" | "analyst" | "orchestrator",
  "action": "specific action name",
  "parameters": { relevant parameters extracted from the command },
  "confidence": 0.0-1.0
}`,
      tier: 'fast',
      maxTokens: 512,
      temperature: 0.2,
      agentType: 'orchestrator',
      action: 'parse_command',
    });

    try {
      return JSON.parse(response.content) as OrchestratorCommand;
    } catch {
      return {
        intent: userInput,
        targetAgent: 'orchestrator' as AgentType,
        action: 'unknown',
        parameters: { raw_input: userInput },
        confidence: 0.1,
      };
    }
  }

  /**
   * Create a multi-step execution plan for complex requests.
   */
  async createPlan(
    userInput: string,
    context: Record<string, unknown>,
  ): Promise<OrchestratorPlan> {
    const response = await aiGateway({
      messages: [
        {
          role: 'user',
          content: `Create an execution plan for: "${userInput}"\n\nContext: ${JSON.stringify(context)}`,
        },
      ],
      system: `You are a task planner for a CRM system. Break down complex requests into ordered steps.

Available agents and their actions:
- scout: research_prospect, find_similar, map_org_chart
- composer: compose_email, compose_sms, compose_linkedin, generate_alternatives
- cadence: check_pacing, get_recommendations, optimal_send_time
- analyst: score_deal, score_candidate, pipeline_insights

Return ONLY valid JSON:
{
  "steps": [
    {
      "order": 1,
      "agent": "agent_name",
      "action": "action_name",
      "description": "What this step does",
      "parameters": {},
      "dependsOn": []
    }
  ],
  "summary": "Brief description of the full plan",
  "estimatedDuration": "e.g., '30 seconds'"
}`,
      tier: 'standard',
      maxTokens: 2048,
      temperature: 0.3,
      agentType: 'orchestrator',
      action: 'create_plan',
    });

    try {
      return JSON.parse(response.content) as OrchestratorPlan;
    } catch {
      return {
        steps: [
          {
            order: 1,
            agent: 'orchestrator' as AgentType,
            action: 'manual_review',
            description: 'Could not auto-plan. Please specify the request more clearly.',
            parameters: { raw_input: userInput },
            dependsOn: [],
          },
        ],
        summary: 'Unable to create automated plan. Manual review needed.',
        estimatedDuration: 'N/A',
      };
    }
  }

  /**
   * Generate a natural language response summarizing completed actions.
   */
  async summarizeResults(
    originalCommand: string,
    results: Array<{ agent: string; action: string; result: unknown }>,
  ): Promise<string> {
    const response = await aiGateway({
      messages: [
        {
          role: 'user',
          content: `Summarize the results of this command: "${originalCommand}"

Results:
${results.map((r) => `- ${r.agent}.${r.action}: ${JSON.stringify(r.result)}`).join('\n')}

Write a brief, conversational summary. Be specific about what was done.`,
        },
      ],
      system:
        'You are a helpful CRM assistant. Summarize completed actions in a natural, conversational tone. Be concise.',
      tier: 'fast',
      maxTokens: 512,
      temperature: 0.5,
      agentType: 'orchestrator',
      action: 'summarize',
    });

    return response.content;
  }
}
