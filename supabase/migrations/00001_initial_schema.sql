-- Mercury: Initial database schema
-- Migration: 00001_initial_schema
-- Description: Creates all core tables and indexes

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =============================================================================
-- USERS
-- =============================================================================
create table public.users (
  id            uuid primary key default uuid_generate_v4(),
  email         text unique not null,
  full_name     text not null,
  avatar_url    text,
  timezone      text not null default 'America/New_York',
  settings      jsonb not null default '{}'::jsonb,
  onboarding    jsonb not null default '{"completed": false}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.users is 'Mercury user profiles, linked to Supabase Auth.';

-- =============================================================================
-- LINKED ACCOUNTS
-- =============================================================================
create table public.linked_accounts (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  provider        text not null check (provider in ('google', 'microsoft', 'linkedin')),
  provider_uid    text not null,
  access_token    text not null,
  refresh_token   text,
  token_expires   timestamptz,
  scopes          text[] not null default '{}',
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (user_id, provider, provider_uid)
);

comment on table public.linked_accounts is 'OAuth tokens for Gmail, Calendar, LinkedIn, etc.';

-- =============================================================================
-- COMPANIES
-- =============================================================================
create table public.companies (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  name            text not null,
  domain          text,
  industry        text,
  size            text,
  linkedin_url    text,
  logo_url        text,
  enrichment_data jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.companies is 'Companies associated with contacts.';

-- =============================================================================
-- CONTACTS
-- =============================================================================
create table public.contacts (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references public.users(id) on delete cascade,
  email                 text,
  full_name             text not null,
  first_name            text,
  last_name             text,
  phone                 text,
  title                 text,
  company_id            uuid references public.companies(id) on delete set null,
  linkedin_url          text,
  avatar_url            text,
  segment               text not null default 'keep_warm' check (
                          segment in ('inner_circle', 'active_deal', 'keep_warm', 'dormant')
                        ),
  outreach_path         text not null default 'inbound' check (
                          outreach_path in ('inbound', 'warm_intro', 'cold_outbound', 'event')
                        ),
  warm_intro_via        uuid references public.contacts(id) on delete set null,
  relationship_score    real not null default 0.0 check (
                          relationship_score >= 0 and relationship_score <= 1
                        ),
  last_interaction_at   timestamptz,
  next_followup_at      timestamptz,
  tags                  text[] not null default '{}',
  notes                 text,
  enrichment_data       jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.contacts is 'People the user is networking / selling to.';
comment on column public.contacts.warm_intro_via is 'Self-referential FK – who introduced this contact.';

-- =============================================================================
-- INTERACTIONS
-- =============================================================================
create table public.interactions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  contact_id      uuid not null references public.contacts(id) on delete cascade,
  channel         text not null check (
                    channel in ('email', 'linkedin', 'phone', 'meeting', 'text', 'other')
                  ),
  direction       text not null check (direction in ('inbound', 'outbound')),
  subject         text,
  body_snippet    text,
  sentiment       text check (sentiment in ('positive', 'neutral', 'negative')),
  intent          text,
  thread_id       text,
  message_id      text unique,
  metadata        jsonb not null default '{}'::jsonb,
  occurred_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

comment on table public.interactions is 'Every email, call, meeting, etc.';

-- =============================================================================
-- ACTIONS
-- =============================================================================
create table public.actions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  contact_id      uuid references public.contacts(id) on delete set null,
  type            text not null check (
                    type in ('reply_draft', 'follow_up', 'intro_request', 'prep_brief', 'custom')
                  ),
  status          text not null default 'pending' check (
                    status in ('pending', 'snoozed', 'done', 'dismissed')
                  ),
  priority        integer not null default 50 check (priority >= 0 and priority <= 100),
  title           text not null,
  body            text,
  draft_content   text,
  due_at          timestamptz,
  snoozed_until   timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.actions is 'AI-generated action cards shown in the daily feed.';

-- =============================================================================
-- PIPELINES
-- =============================================================================
create table public.pipelines (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  name        text not null,
  kind        text not null default 'sales' check (kind in ('sales', 'recruiting', 'fundraising', 'custom')),
  stages      jsonb not null default '[]'::jsonb,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.pipelines is 'Kanban-style deal / candidate pipelines.';

-- =============================================================================
-- PIPELINE ITEMS
-- =============================================================================
create table public.pipeline_items (
  id            uuid primary key default uuid_generate_v4(),
  pipeline_id   uuid not null references public.pipelines(id) on delete cascade,
  contact_id    uuid references public.contacts(id) on delete set null,
  stage         text not null,
  value         numeric(14,2),
  currency      text not null default 'USD',
  notes         text,
  metadata      jsonb not null default '{}'::jsonb,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.pipeline_items is 'Individual cards inside a pipeline.';

-- =============================================================================
-- AGENT LOGS
-- =============================================================================
create table public.agent_logs (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  action          text not null,
  model           text not null,
  input_tokens    integer not null default 0,
  output_tokens   integer not null default 0,
  latency_ms      integer,
  request_body    jsonb,
  response_body   jsonb,
  error           text,
  created_at      timestamptz not null default now()
);

comment on table public.agent_logs is 'Audit trail for every LLM call.';

-- =============================================================================
-- STYLE EDITS
-- =============================================================================
create table public.style_edits (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  contact_id      uuid references public.contacts(id) on delete set null,
  original_text   text not null,
  edited_text     text not null,
  edit_type       text not null check (
                    edit_type in ('tone', 'length', 'formality', 'content', 'other')
                  ),
  context         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

comment on table public.style_edits is 'User corrections to AI drafts – used for personalisation fine-tuning.';

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Contacts: fast lookup by user + segment, user + outreach_path, user + last_interaction
create index idx_contacts_user_segment
  on public.contacts (user_id, segment);

create index idx_contacts_user_path
  on public.contacts (user_id, outreach_path);

create index idx_contacts_user_last
  on public.contacts (user_id, last_interaction_at desc nulls last);

-- Interactions: fast lookup by user + contact, thread grouping
create index idx_interactions_user_contact
  on public.interactions (user_id, contact_id, occurred_at desc);

create index idx_interactions_thread
  on public.interactions (thread_id)
  where thread_id is not null;

-- Actions: pending actions feed
create index idx_actions_user_status
  on public.actions (user_id, status, priority desc);

-- Pipeline items: board view
create index idx_pipeline_items_pipeline_stage
  on public.pipeline_items (pipeline_id, stage, position);
