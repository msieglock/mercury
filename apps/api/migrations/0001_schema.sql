-- Mercury: D1/SQLite Schema Migration
-- Converted from PostgreSQL/Supabase to Cloudflare D1
-- Migration: 0001_schema

PRAGMA foreign_keys = ON;

-- =============================================================================
-- USERS
-- =============================================================================
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  full_name     TEXT NOT NULL,
  avatar_url    TEXT,
  timezone      TEXT NOT NULL DEFAULT 'America/New_York',
  settings      TEXT NOT NULL DEFAULT '{}',
  onboarding    TEXT NOT NULL DEFAULT '{"completed": false}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =============================================================================
-- LINKED ACCOUNTS
-- =============================================================================
CREATE TABLE linked_accounts (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL CHECK (provider IN ('google', 'microsoft', 'linkedin')),
  provider_uid    TEXT NOT NULL,
  access_token    TEXT NOT NULL,
  refresh_token   TEXT,
  token_expires   TEXT,
  scopes          TEXT NOT NULL DEFAULT '[]',
  metadata        TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),

  UNIQUE (user_id, provider, provider_uid)
);

-- =============================================================================
-- COMPANIES
-- =============================================================================
CREATE TABLE companies (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  domain          TEXT,
  industry        TEXT,
  size            TEXT,
  linkedin_url    TEXT,
  logo_url        TEXT,
  enrichment_data TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =============================================================================
-- CONTACTS
-- =============================================================================
CREATE TABLE contacts (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email                 TEXT,
  full_name             TEXT NOT NULL,
  first_name            TEXT,
  last_name             TEXT,
  phone                 TEXT,
  title                 TEXT,
  company_id            TEXT REFERENCES companies(id) ON DELETE SET NULL,
  linkedin_url          TEXT,
  avatar_url            TEXT,
  segment               TEXT NOT NULL DEFAULT 'keep_warm' CHECK (
                          segment IN ('inner_circle', 'active_deal', 'keep_warm', 'dormant')
                        ),
  outreach_path         TEXT NOT NULL DEFAULT 'inbound' CHECK (
                          outreach_path IN ('inbound', 'warm_intro', 'cold_outbound', 'event')
                        ),
  warm_intro_via        TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  relationship_score    REAL NOT NULL DEFAULT 0.0 CHECK (
                          relationship_score >= 0 AND relationship_score <= 1
                        ),
  last_interaction_at   TEXT,
  next_followup_at      TEXT,
  tags                  TEXT NOT NULL DEFAULT '[]',
  notes                 TEXT,
  enrichment_data       TEXT NOT NULL DEFAULT '{}',
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =============================================================================
-- INTERACTIONS
-- =============================================================================
CREATE TABLE interactions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id      TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL CHECK (
                    channel IN ('email', 'linkedin', 'phone', 'meeting', 'text', 'other')
                  ),
  direction       TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  subject         TEXT,
  body_snippet    TEXT,
  sentiment       TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  intent          TEXT,
  thread_id       TEXT,
  message_id      TEXT UNIQUE,
  metadata        TEXT NOT NULL DEFAULT '{}',
  occurred_at     TEXT NOT NULL DEFAULT (datetime('now')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =============================================================================
-- ACTIONS
-- =============================================================================
CREATE TABLE actions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id      TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  type            TEXT NOT NULL CHECK (
                    type IN ('reply_draft', 'follow_up', 'intro_request', 'prep_brief', 'custom')
                  ),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (
                    status IN ('pending', 'snoozed', 'done', 'dismissed')
                  ),
  priority        INTEGER NOT NULL DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  title           TEXT NOT NULL,
  body            TEXT,
  draft_content   TEXT,
  due_at          TEXT,
  snoozed_until   TEXT,
  metadata        TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =============================================================================
-- PIPELINES
-- =============================================================================
CREATE TABLE pipelines (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'sales' CHECK (kind IN ('sales', 'recruiting', 'fundraising', 'custom')),
  stages      TEXT NOT NULL DEFAULT '[]',
  settings    TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =============================================================================
-- PIPELINE ITEMS
-- =============================================================================
CREATE TABLE pipeline_items (
  id            TEXT PRIMARY KEY,
  pipeline_id   TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  contact_id    TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  stage         TEXT NOT NULL,
  value         REAL,
  currency      TEXT NOT NULL DEFAULT 'USD',
  notes         TEXT,
  metadata      TEXT NOT NULL DEFAULT '{}',
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =============================================================================
-- AGENT LOGS
-- =============================================================================
CREATE TABLE agent_logs (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action          TEXT NOT NULL,
  model           TEXT NOT NULL,
  input_tokens    INTEGER NOT NULL DEFAULT 0,
  output_tokens   INTEGER NOT NULL DEFAULT 0,
  latency_ms      INTEGER,
  request_body    TEXT,
  response_body   TEXT,
  error           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =============================================================================
-- STYLE EDITS
-- =============================================================================
CREATE TABLE style_edits (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id      TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  original_text   TEXT NOT NULL,
  edited_text     TEXT NOT NULL,
  edit_type       TEXT NOT NULL CHECK (
                    edit_type IN ('tone', 'length', 'formality', 'content', 'other')
                  ),
  context         TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Contacts: fast lookup by user + segment, user + outreach_path, user + last_interaction
CREATE INDEX idx_contacts_user_segment
  ON contacts (user_id, segment);

CREATE INDEX idx_contacts_user_path
  ON contacts (user_id, outreach_path);

CREATE INDEX idx_contacts_user_last
  ON contacts (user_id, last_interaction_at DESC);

-- Interactions: fast lookup by user + contact, thread grouping
CREATE INDEX idx_interactions_user_contact
  ON interactions (user_id, contact_id, occurred_at DESC);

CREATE INDEX idx_interactions_thread
  ON interactions (thread_id);

-- Actions: pending actions feed
CREATE INDEX idx_actions_user_status
  ON actions (user_id, status, priority DESC);

-- Pipeline items: board view
CREATE INDEX idx_pipeline_items_pipeline_stage
  ON pipeline_items (pipeline_id, stage, position);
