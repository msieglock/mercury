-- Mercury: Full Features Migration
-- Adds: notifications, sequences, organizations, user settings columns, search index

-- =============================================================================
-- USER SETTINGS COLUMNS
-- =============================================================================
ALTER TABLE users ADD COLUMN icp TEXT;
ALTER TABLE users ADD COLUMN auto_follow_up INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN auto_respond INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN auto_log_meetings INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notification_prefs TEXT NOT NULL DEFAULT '{}';

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================
CREATE TABLE notifications (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (
                  type IN ('action_created', 'draft_ready', 'prospect_matched', 'deal_moved', 'follow_up_due', 'sync_complete', 'sequence_step', 'system')
                ),
  title         TEXT NOT NULL,
  body          TEXT,
  link          TEXT,
  read          INTEGER NOT NULL DEFAULT 0,
  metadata      TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_notifications_user_read
  ON notifications (user_id, read, created_at DESC);

-- =============================================================================
-- SEQUENCES (Auto Follow-Up Cadences)
-- =============================================================================
CREATE TABLE sequences (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  trigger_type  TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'segment_enter', 'no_reply')),
  settings      TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sequence_steps (
  id            TEXT PRIMARY KEY,
  sequence_id   TEXT NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  step_order    INTEGER NOT NULL,
  delay_days    INTEGER NOT NULL DEFAULT 0,
  channel       TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'linkedin')),
  template      TEXT NOT NULL DEFAULT '',
  subject       TEXT,
  settings      TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sequence_steps_order
  ON sequence_steps (sequence_id, step_order);

CREATE TABLE sequence_enrollments (
  id              TEXT PRIMARY KEY,
  sequence_id     TEXT NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  contact_id      TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_step    INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'replied', 'bounced')),
  next_step_at    TEXT,
  metadata        TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (sequence_id, contact_id)
);

CREATE INDEX idx_enrollments_next_step
  ON sequence_enrollments (status, next_step_at);

-- =============================================================================
-- ORGANIZATIONS (Multi-User / Teams)
-- =============================================================================
CREATE TABLE organizations (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  domain        TEXT,
  plan          TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team', 'enterprise')),
  settings      TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE org_members (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  joined_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (org_id, user_id)
);

ALTER TABLE users ADD COLUMN org_id TEXT REFERENCES organizations(id) ON DELETE SET NULL;

-- Share pipelines within org
ALTER TABLE pipelines ADD COLUMN org_id TEXT REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE pipelines ADD COLUMN shared INTEGER NOT NULL DEFAULT 0;
