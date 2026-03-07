// Gateway
export {
  aiGateway,
  aiGatewayStream,
  GatewayError,
} from './gateway';
export type {
  ModelTier,
  GatewayRequest,
  GatewayResponse,
  GatewayStreamChunk,
} from './gateway';

// Tone Engine
export { ToneEngine } from './tone-engine';

// Agents
export { ScoutAgent } from './agents/scout';
export type {
  ProspectResearchResult,
  OrgChartEntry,
  SimilarContact,
} from './agents/scout';

export { ComposerAgent } from './agents/composer';

export { CadenceAgent } from './agents/cadence';
export type {
  CadenceRecommendation,
  PacingStatus,
} from './agents/cadence';

export { AnalystAgent } from './agents/analyst';
export type {
  DealScore,
  CandidateScore,
  PipelineInsight,
} from './agents/analyst';

export { OrchestratorAgent } from './agents/orchestrator';
export type {
  OrchestratorCommand,
  OrchestratorPlan,
  OrchestratorStep,
} from './agents/orchestrator';

// Prompts
export {
  styleAnalysisPrompt,
  emailCompositionPrompt,
  messageClassificationPrompt,
  meetingPrepPrompt,
  dealScoringPrompt,
  candidateScoringPrompt,
} from './prompts';
