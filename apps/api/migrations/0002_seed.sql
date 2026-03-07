-- Mercury: D1/SQLite Seed Data
-- Converted from PostgreSQL/Supabase to Cloudflare D1
-- Migration: 0002_seed
-- NOTE: This migration should only be run in local / dev environments.

-- =============================================================================
-- Demo user
-- =============================================================================
INSERT INTO users (id, email, full_name, timezone, settings, onboarding)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo@mercury.dev',
  'Alex Mercury',
  'America/New_York',
  '{"theme": "system", "daily_briefing": true, "notification_emails": true}',
  '{"completed": true, "completed_at": "2026-01-15T10:00:00Z"}'
);

-- =============================================================================
-- Companies
-- =============================================================================
INSERT INTO companies (id, user_id, name, domain, industry, size, linkedin_url) VALUES
  ('00000000-0000-0000-0000-c00000000001',
   '00000000-0000-0000-0000-000000000001',
   'Acme Corp', 'acme.com', 'Technology', '201-500',
   'https://linkedin.com/company/acme-corp');

INSERT INTO companies (id, user_id, name, domain, industry, size, linkedin_url) VALUES
  ('00000000-0000-0000-0000-c00000000002',
   '00000000-0000-0000-0000-000000000001',
   'Globex Industries', 'globex.io', 'Manufacturing', '51-200',
   'https://linkedin.com/company/globex');

INSERT INTO companies (id, user_id, name, domain, industry, size, linkedin_url) VALUES
  ('00000000-0000-0000-0000-c00000000003',
   '00000000-0000-0000-0000-000000000001',
   'Initech', 'initech.com', 'Finance', '1001-5000',
   'https://linkedin.com/company/initech');

-- =============================================================================
-- Contacts
-- =============================================================================

-- Contact 1: inner circle, inbound
INSERT INTO contacts
  (id, user_id, email, full_name, first_name, last_name, title, company_id,
   segment, outreach_path, warm_intro_via, relationship_score,
   last_interaction_at, next_followup_at, tags)
VALUES
  ('00000000-0000-0000-0000-a00000000001',
   '00000000-0000-0000-0000-000000000001',
   'sarah@acme.com', 'Sarah Chen', 'Sarah', 'Chen',
   'VP of Engineering', '00000000-0000-0000-0000-c00000000001',
   'inner_circle', 'inbound', NULL, 0.92,
   datetime('now', '-1 day'), datetime('now', '+3 days'),
   '["champion", "technical"]');

-- Contact 2: active deal, warm intro (introduced by Sarah)
INSERT INTO contacts
  (id, user_id, email, full_name, first_name, last_name, title, company_id,
   segment, outreach_path, warm_intro_via, relationship_score,
   last_interaction_at, next_followup_at, tags)
VALUES
  ('00000000-0000-0000-0000-a00000000002',
   '00000000-0000-0000-0000-000000000001',
   'james@globex.io', 'James Rodriguez', 'James', 'Rodriguez',
   'CTO', '00000000-0000-0000-0000-c00000000002',
   'active_deal', 'warm_intro', '00000000-0000-0000-0000-a00000000001', 0.74,
   datetime('now', '-3 days'), datetime('now', '+1 day'),
   '["decision_maker", "technical"]');

-- Contact 3: keep warm, cold outbound
INSERT INTO contacts
  (id, user_id, email, full_name, first_name, last_name, title, company_id,
   segment, outreach_path, warm_intro_via, relationship_score,
   last_interaction_at, next_followup_at, tags)
VALUES
  ('00000000-0000-0000-0000-a00000000003',
   '00000000-0000-0000-0000-000000000001',
   'priya@initech.com', 'Priya Patel', 'Priya', 'Patel',
   'Director of Product', '00000000-0000-0000-0000-c00000000003',
   'keep_warm', 'cold_outbound', NULL, 0.45,
   datetime('now', '-10 days'), datetime('now', '+7 days'),
   '["product"]');

-- Contact 4: dormant, event
INSERT INTO contacts
  (id, user_id, email, full_name, first_name, last_name, title, company_id,
   segment, outreach_path, warm_intro_via, relationship_score,
   last_interaction_at, next_followup_at, tags)
VALUES
  ('00000000-0000-0000-0000-a00000000004',
   '00000000-0000-0000-0000-000000000001',
   'mike@example.com', 'Mike Thompson', 'Mike', 'Thompson',
   'Founder & CEO', NULL,
   'dormant', 'event', NULL, 0.18,
   datetime('now', '-45 days'), NULL,
   '["founder", "saas"]');

-- Contact 5: active deal, inbound
INSERT INTO contacts
  (id, user_id, email, full_name, first_name, last_name, title, company_id,
   segment, outreach_path, warm_intro_via, relationship_score,
   last_interaction_at, next_followup_at, tags)
VALUES
  ('00000000-0000-0000-0000-a00000000005',
   '00000000-0000-0000-0000-000000000001',
   'lisa@acme.com', 'Lisa Wang', 'Lisa', 'Wang',
   'Head of Sales', '00000000-0000-0000-0000-c00000000001',
   'active_deal', 'inbound', NULL, 0.81,
   datetime('now', '-2 days'), datetime('now', '+2 days'),
   '["decision_maker", "budget_holder"]');

-- =============================================================================
-- Sales pipeline
-- =============================================================================
INSERT INTO pipelines (id, user_id, name, kind, stages)
VALUES (
  '00000000-0000-0000-0000-p00000000001',
  '00000000-0000-0000-0000-000000000001',
  'Sales Pipeline',
  'sales',
  '[{"key": "lead", "label": "Lead", "order": 1}, {"key": "contacted", "label": "Contacted", "order": 2}, {"key": "meeting_scheduled", "label": "Meeting Scheduled", "order": 3}, {"key": "proposal_sent", "label": "Proposal Sent", "order": 4}, {"key": "negotiation", "label": "Negotiation", "order": 5}, {"key": "closed_won", "label": "Closed Won", "order": 6}, {"key": "closed_lost", "label": "Closed Lost", "order": 7}]'
);

-- Sales pipeline items
INSERT INTO pipeline_items (id, pipeline_id, contact_id, stage, value, notes, position)
VALUES
  ('a1b2c3d4-0001-4000-8000-000000000001',
   '00000000-0000-0000-0000-p00000000001',
   '00000000-0000-0000-0000-a00000000002',
   'meeting_scheduled', 75000.00, 'Demo next week', 0);

INSERT INTO pipeline_items (id, pipeline_id, contact_id, stage, value, notes, position)
VALUES
  ('a1b2c3d4-0002-4000-8000-000000000002',
   '00000000-0000-0000-0000-p00000000001',
   '00000000-0000-0000-0000-a00000000005',
   'proposal_sent', 120000.00, 'Waiting on legal review', 0);

INSERT INTO pipeline_items (id, pipeline_id, contact_id, stage, value, notes, position)
VALUES
  ('a1b2c3d4-0003-4000-8000-000000000003',
   '00000000-0000-0000-0000-p00000000001',
   '00000000-0000-0000-0000-a00000000003',
   'lead', 50000.00, 'Initial outreach done', 0);

-- =============================================================================
-- Recruiting pipeline
-- =============================================================================
INSERT INTO pipelines (id, user_id, name, kind, stages)
VALUES (
  '00000000-0000-0000-0000-p00000000002',
  '00000000-0000-0000-0000-000000000001',
  'Recruiting Pipeline',
  'recruiting',
  '[{"key": "sourced", "label": "Sourced", "order": 1}, {"key": "reached_out", "label": "Reached Out", "order": 2}, {"key": "responded", "label": "Responded", "order": 3}, {"key": "phone_screen", "label": "Phone Screen", "order": 4}, {"key": "interview", "label": "Interview", "order": 5}, {"key": "offer", "label": "Offer", "order": 6}, {"key": "hired", "label": "Hired", "order": 7}, {"key": "passed", "label": "Passed", "order": 8}]'
);

-- =============================================================================
-- Interactions (10 sample)
-- =============================================================================

-- Sarah Chen interactions (inner circle)
INSERT INTO interactions
  (id, user_id, contact_id, channel, direction, subject, body_snippet, sentiment, intent, thread_id, occurred_at)
VALUES
  ('b2c3d4e5-0001-4000-8000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000001',
   'email', 'inbound',
   'Re: Q2 Roadmap Discussion',
   'Hey Alex, loved the deck. Let''s loop in James from Globex...',
   'positive', 'introduction', 'thread_001',
   datetime('now', '-1 day'));

INSERT INTO interactions
  (id, user_id, contact_id, channel, direction, subject, body_snippet, sentiment, intent, thread_id, occurred_at)
VALUES
  ('b2c3d4e5-0002-4000-8000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000001',
   'email', 'outbound',
   'Q2 Roadmap Discussion',
   'Hi Sarah, wanted to share our updated roadmap with you...',
   'positive', 'share_update', 'thread_001',
   datetime('now', '-2 days'));

INSERT INTO interactions
  (id, user_id, contact_id, channel, direction, subject, body_snippet, sentiment, intent, thread_id, occurred_at)
VALUES
  ('b2c3d4e5-0003-4000-8000-000000000003',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000001',
   'meeting', 'outbound',
   'Monthly Sync',
   'Covered: product updates, partnership status, Q2 targets.',
   'positive', 'relationship_building', NULL,
   datetime('now', '-14 days'));

-- James Rodriguez interactions (active deal)
INSERT INTO interactions
  (id, user_id, contact_id, channel, direction, subject, body_snippet, sentiment, intent, thread_id, occurred_at)
VALUES
  ('b2c3d4e5-0004-4000-8000-000000000004',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000002',
   'email', 'inbound',
   'Re: Introduction from Sarah',
   'Thanks for reaching out. Would love to learn more about...',
   'positive', 'interest', 'thread_002',
   datetime('now', '-3 days'));

INSERT INTO interactions
  (id, user_id, contact_id, channel, direction, subject, body_snippet, sentiment, intent, thread_id, occurred_at)
VALUES
  ('b2c3d4e5-0005-4000-8000-000000000005',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000002',
   'email', 'outbound',
   'Introduction from Sarah',
   'Hi James, Sarah Chen suggested we connect regarding...',
   'neutral', 'introduction', 'thread_002',
   datetime('now', '-5 days'));

INSERT INTO interactions
  (id, user_id, contact_id, channel, direction, subject, body_snippet, sentiment, intent, thread_id, occurred_at)
VALUES
  ('b2c3d4e5-0006-4000-8000-000000000006',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000002',
   'linkedin', 'outbound',
   NULL,
   'Connected on LinkedIn after Sarah''s intro.',
   'neutral', 'connect', NULL,
   datetime('now', '-6 days'));

-- Priya Patel interactions (keep warm)
INSERT INTO interactions
  (id, user_id, contact_id, channel, direction, subject, body_snippet, sentiment, intent, thread_id, occurred_at)
VALUES
  ('b2c3d4e5-0007-4000-8000-000000000007',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000003',
   'email', 'outbound',
   'Following up on SaaS Metrics Report',
   'Hi Priya, wanted to share that report I mentioned...',
   'neutral', 'follow_up', 'thread_003',
   datetime('now', '-10 days'));

INSERT INTO interactions
  (id, user_id, contact_id, channel, direction, subject, body_snippet, sentiment, intent, thread_id, occurred_at)
VALUES
  ('b2c3d4e5-0008-4000-8000-000000000008',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000003',
   'email', 'inbound',
   'Re: Following up on SaaS Metrics Report',
   'Thanks Alex, will review and get back to you.',
   'neutral', 'acknowledge', 'thread_003',
   datetime('now', '-9 days'));

-- Mike Thompson (dormant)
INSERT INTO interactions
  (id, user_id, contact_id, channel, direction, subject, body_snippet, sentiment, intent, thread_id, occurred_at)
VALUES
  ('b2c3d4e5-0009-4000-8000-000000000009',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000004',
   'meeting', 'outbound',
   'Met at TechCrunch Disrupt',
   'Brief chat about his new startup. Exchanged cards.',
   'positive', 'networking', NULL,
   datetime('now', '-45 days'));

-- Lisa Wang interactions (active deal)
INSERT INTO interactions
  (id, user_id, contact_id, channel, direction, subject, body_snippet, sentiment, intent, thread_id, occurred_at)
VALUES
  ('b2c3d4e5-0010-4000-8000-000000000010',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000005',
   'email', 'inbound',
   'Re: Proposal - Enterprise Plan',
   'Alex, the team likes the proposal. Just need to run it by legal...',
   'positive', 'deal_progress', 'thread_004',
   datetime('now', '-2 days'));

-- =============================================================================
-- Actions (5 sample cards of different types)
-- =============================================================================

-- Reply draft for James
INSERT INTO actions
  (id, user_id, contact_id, type, status, priority, title, body, draft_content, due_at)
VALUES
  ('c3d4e5f6-0001-4000-8000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000002',
   'reply_draft', 'pending', 90,
   'Reply to James Rodriguez',
   'James expressed interest after Sarah''s introduction. Suggest scheduling a demo.',
   'Hi James,

Great to hear you''re interested! I''d love to walk you through a quick demo. Would Thursday at 2pm PT work for you?

Looking forward to it,
Alex',
   datetime('now', '+1 day'));

-- Follow up with Priya
INSERT INTO actions
  (id, user_id, contact_id, type, status, priority, title, body, draft_content, due_at)
VALUES
  ('c3d4e5f6-0002-4000-8000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000003',
   'follow_up', 'pending', 60,
   'Follow up with Priya Patel',
   'It''s been 10 days since Priya said she''d review the report. Time for a gentle nudge.',
   NULL,
   datetime('now'));

-- Intro request
INSERT INTO actions
  (id, user_id, contact_id, type, status, priority, title, body, draft_content, due_at)
VALUES
  ('c3d4e5f6-0003-4000-8000-000000000003',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000001',
   'intro_request', 'pending', 70,
   'Ask Sarah for intro to Acme CFO',
   'Sarah is well-connected at Acme. Consider asking for an introduction to the CFO to discuss budget.',
   NULL,
   datetime('now', '+3 days'));

-- Prep brief
INSERT INTO actions
  (id, user_id, contact_id, type, status, priority, title, body, draft_content, due_at)
VALUES
  ('c3d4e5f6-0004-4000-8000-000000000004',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000005',
   'prep_brief', 'pending', 80,
   'Prepare for Lisa Wang follow-up call',
   'Lisa''s team likes the proposal but legal is reviewing. Prepare talking points for objection handling.',
   NULL,
   datetime('now', '+2 days'));

-- Custom action (snoozed)
INSERT INTO actions
  (id, user_id, contact_id, type, status, priority, title, body, draft_content, due_at)
VALUES
  ('c3d4e5f6-0005-4000-8000-000000000005',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000004',
   'custom', 'snoozed', 30,
   'Re-engage Mike Thompson',
   'Haven''t spoken since TechCrunch Disrupt. Consider sending an article or congrats on his funding round.',
   NULL,
   datetime('now', '+14 days'));
