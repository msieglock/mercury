import { ActionType, OutreachPath } from '../types';

// ─── Outreach Path Labels ────────────────────────────────────────────────────

export const OUTREACH_PATH_LABELS: Record<
  OutreachPath,
  { icon: string; label: string; description: string }
> = {
  [OutreachPath.direct_inbox]: {
    icon: '\u{1F7E2}',
    label: 'Direct Inbox',
    description: 'Email directly from your inbox with full history',
  },
  [OutreachPath.direct_text]: {
    icon: '\u{1F4F1}',
    label: 'Direct Text',
    description: 'SMS or iMessage outreach',
  },
  [OutreachPath.direct_linkedin]: {
    icon: '\u{1F4BC}',
    label: 'Direct LinkedIn',
    description: 'LinkedIn InMail or connection message',
  },
  [OutreachPath.warm_intro]: {
    icon: '\u{1F91D}',
    label: 'Warm Intro',
    description: 'Introduction through a mutual connection',
  },
  [OutreachPath.second_degree]: {
    icon: '\u{1F517}',
    label: 'Second Degree',
    description: 'Reach out via a shared connection or community',
  },
  [OutreachPath.cold_enriched]: {
    icon: '\u{2744}\u{FE0F}',
    label: 'Cold Enriched',
    description: 'Cold outreach with enriched data for personalization',
  },
  [OutreachPath.cold_research]: {
    icon: '\u{1F50D}',
    label: 'Cold Research',
    description: 'Cold outreach backed by deep research',
  },
};

// ─── Action Type Labels ──────────────────────────────────────────────────────

export const ACTION_TYPE_LABELS: Record<
  ActionType,
  { label: string; description: string }
> = {
  [ActionType.follow_up]: {
    label: 'Follow Up',
    description: 'Send a follow-up message to re-engage',
  },
  [ActionType.reply_needed]: {
    label: 'Reply Needed',
    description: 'An incoming message requires your response',
  },
  [ActionType.warm_intro]: {
    label: 'Warm Intro',
    description: 'Request or facilitate a warm introduction',
  },
  [ActionType.meeting_prep]: {
    label: 'Meeting Prep',
    description: 'Prepare briefing notes for an upcoming meeting',
  },
  [ActionType.new_prospect]: {
    label: 'New Prospect',
    description: 'A new prospect has been identified for outreach',
  },
  [ActionType.deal_cold]: {
    label: 'Deal Going Cold',
    description: 'A deal or candidate is losing momentum',
  },
  [ActionType.candidate_responded]: {
    label: 'Candidate Responded',
    description: 'A recruiting candidate has replied',
  },
  [ActionType.log_notes]: {
    label: 'Log Notes',
    description: 'Record notes from a recent interaction',
  },
};

// ─── Pacing Rules ────────────────────────────────────────────────────────────

export const PACING_RULES = {
  max_emails_per_contact_per_week: 2,
  min_hours_between_emails: 48,
  max_emails_per_company_per_day: 5,
  max_bounce_rate: 0.03,
} as const;

// ─── Style Defaults ──────────────────────────────────────────────────────────

export const STYLE_DEFAULTS = {
  formality: 5,
  warmth: 5,
  humor: 3,
} as const;

// ─── Pipeline Stages ─────────────────────────────────────────────────────────

export const PIPELINE_STAGES = {
  sales: [
    'Lead',
    'Contacted',
    'Meeting Scheduled',
    'Proposal Sent',
    'Negotiation',
    'Closed Won',
    'Closed Lost',
  ],
  recruiting: [
    'Sourced',
    'Reached Out',
    'Responded',
    'Phone Screen',
    'Interview',
    'Offer',
    'Hired',
    'Passed',
  ],
} as const;
