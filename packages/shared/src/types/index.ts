// ─── Enums ───────────────────────────────────────────────────────────────────

export enum ActionType {
  follow_up = 'follow_up',
  reply_needed = 'reply_needed',
  warm_intro = 'warm_intro',
  meeting_prep = 'meeting_prep',
  new_prospect = 'new_prospect',
  deal_cold = 'deal_cold',
  candidate_responded = 'candidate_responded',
  log_notes = 'log_notes',
}

export enum OutreachPath {
  direct_inbox = 'direct_inbox',
  direct_text = 'direct_text',
  direct_linkedin = 'direct_linkedin',
  warm_intro = 'warm_intro',
  second_degree = 'second_degree',
  cold_enriched = 'cold_enriched',
  cold_research = 'cold_research',
}

export enum ContactSegment {
  hot_lead = 'hot_lead',
  warm = 'warm',
  cold = 'cold',
  candidate = 'candidate',
  customer = 'customer',
  connected = 'connected',
  needs_followup = 'needs_followup',
}

export enum UserMode {
  sales = 'sales',
  recruit = 'recruit',
  manage = 'manage',
}

export enum MessageIntent {
  interested = 'interested',
  question = 'question',
  objection = 'objection',
  not_now = 'not_now',
  referral = 'referral',
  ooo = 'ooo',
}

export enum Provider {
  google = 'google',
  microsoft = 'microsoft',
  linkedin = 'linkedin',
  twilio = 'twilio',
}

export enum AgentType {
  scout = 'scout',
  composer = 'composer',
  cadence = 'cadence',
  analyst = 'analyst',
  orchestrator = 'orchestrator',
}

// ─── Style Fingerprint ──────────────────────────────────────────────────────

export interface StyleFingerprint {
  greeting_style: string;
  sign_off_style: string;
  avg_sentence_length: number;
  vocabulary_level: 'casual' | 'professional' | 'formal' | 'academic';
  emoji_usage: 'never' | 'rare' | 'occasional' | 'frequent';
  punctuation_habits: {
    uses_exclamations: boolean;
    uses_ellipsis: boolean;
    uses_dashes: boolean;
    oxford_comma: boolean;
  };
  tone_markers: {
    formality: number; // 1-10
    warmth: number; // 1-10
    humor: number; // 1-10
    directness: number; // 1-10
    confidence: number; // 1-10
  };
  common_phrases: string[];
  transition_words: string[];
  paragraph_structure: 'short' | 'medium' | 'long';
  question_frequency: 'never' | 'rare' | 'sometimes' | 'often';
  personal_anecdote_frequency: 'never' | 'rare' | 'sometimes' | 'often';
  call_to_action_style: string;
  subject_line_style: string;
}

// ─── Database Entity Types ──────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  mode: UserMode;
  style_fingerprint: StyleFingerprint | null;
  onboarding_completed: boolean;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface LinkedAccount {
  id: string;
  user_id: string;
  provider: Provider;
  provider_account_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company_id: string | null;
  linkedin_url: string | null;
  avatar_url: string | null;
  segment: ContactSegment;
  outreach_path: OutreachPath | null;
  relationship_score: number;
  last_interaction_at: string | null;
  notes: string | null;
  tags: string[];
  enrichment_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  user_id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  logo_url: string | null;
  linkedin_url: string | null;
  description: string | null;
  enrichment_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  user_id: string;
  contact_id: string;
  type: 'email_sent' | 'email_received' | 'sms_sent' | 'sms_received' | 'linkedin_message' | 'meeting' | 'call' | 'note';
  subject: string | null;
  body: string | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  intent: MessageIntent | null;
  channel: string | null;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
  created_at: string;
}

export interface Action {
  id: string;
  user_id: string;
  contact_id: string | null;
  type: ActionType;
  title: string;
  description: string | null;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'pending' | 'snoozed' | 'completed' | 'dismissed';
  agent_type: AgentType;
  due_at: string | null;
  snoozed_until: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Pipeline {
  id: string;
  user_id: string;
  name: string;
  type: 'sales' | 'recruiting';
  stages: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineItem {
  id: string;
  pipeline_id: string;
  contact_id: string;
  stage: string;
  position: number;
  value: number | null;
  expected_close_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentLog {
  id: string;
  user_id: string;
  agent_type: AgentType;
  action: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  tokens_used: number;
  model: string;
  cost_cents: number;
  duration_ms: number;
  error: string | null;
  created_at: string;
}

export interface StyleEdit {
  id: string;
  user_id: string;
  original_draft: string;
  edited_version: string;
  context: Record<string, unknown> | null;
  fingerprint_delta: Partial<StyleFingerprint> | null;
  created_at: string;
}

// ─── UI & API Types ─────────────────────────────────────────────────────────

export interface ActionCardType {
  id: string;
  type: ActionType;
  title: string;
  description: string | null;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  agent_type: AgentType;
  contact_name: string | null;
  contact_title: string | null;
  company_name: string | null;
  due_at: string | null;
  primary_action_label: string;
  primary_action_url: string | null;
  is_overdue: boolean;
  metadata: Record<string, unknown> | null;
}

export interface ComposeContext {
  contact: Contact;
  company: Company | null;
  recent_interactions: Interaction[];
  outreach_path: OutreachPath;
  intent: string;
  user_mode: UserMode;
  additional_context?: string;
}

export interface ComposeRequest {
  user_id: string;
  contact_id: string;
  outreach_path: OutreachPath;
  intent: string;
  context: string | null;
  style_fingerprint: StyleFingerprint | null;
  reply_to_message_id: string | null;
  tone_overrides: Partial<StyleFingerprint['tone_markers']> | null;
}

export interface ComposeResponse {
  subject: string | null;
  body: string;
  confidence: number;
  suggestions: string[];
  tokens_used: number;
  model: string;
}

export interface ClassifyRequest {
  message_body: string;
  message_subject: string | null;
  sender_email: string;
  sender_name: string | null;
  thread_context: string | null;
}

export interface ClassifyResponse {
  intent: MessageIntent;
  confidence: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'immediate' | 'today' | 'this_week' | 'no_rush';
  suggested_action: ActionType | null;
  key_phrases: string[];
  summary: string;
}
