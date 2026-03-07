-- Mercury: Development seed data
-- Migration: 00004_seed_data
-- Description: Demo user, pipelines, contacts, companies, interactions, actions
-- NOTE: This migration should only be run in local / dev environments.

-- =============================================================================
-- Demo user
-- =============================================================================
insert into public.users (id, email, full_name, timezone, settings, onboarding)
values (
  '00000000-0000-0000-0000-000000000001',
  'demo@mercury.dev',
  'Alex Mercury',
  'America/New_York',
  '{"theme": "system", "daily_briefing": true, "notification_emails": true}'::jsonb,
  '{"completed": true, "completed_at": "2026-01-15T10:00:00Z"}'::jsonb
);

-- =============================================================================
-- Companies
-- =============================================================================
insert into public.companies (id, user_id, name, domain, industry, size, linkedin_url) values
  ('00000000-0000-0000-0000-c00000000001',
   '00000000-0000-0000-0000-000000000001',
   'Acme Corp', 'acme.com', 'Technology', '201-500',
   'https://linkedin.com/company/acme-corp'),

  ('00000000-0000-0000-0000-c00000000002',
   '00000000-0000-0000-0000-000000000001',
   'Globex Industries', 'globex.io', 'Manufacturing', '51-200',
   'https://linkedin.com/company/globex'),

  ('00000000-0000-0000-0000-c00000000003',
   '00000000-0000-0000-0000-000000000001',
   'Initech', 'initech.com', 'Finance', '1001-5000',
   'https://linkedin.com/company/initech');

-- =============================================================================
-- Contacts
-- =============================================================================
insert into public.contacts
  (id, user_id, email, full_name, first_name, last_name, title, company_id,
   segment, outreach_path, warm_intro_via, relationship_score,
   last_interaction_at, next_followup_at, tags)
values
  -- Contact 1: inner circle, inbound
  ('00000000-0000-0000-0000-a00000000001',
   '00000000-0000-0000-0000-000000000001',
   'sarah@acme.com', 'Sarah Chen', 'Sarah', 'Chen',
   'VP of Engineering', '00000000-0000-0000-0000-c00000000001',
   'inner_circle', 'inbound', null, 0.92,
   now() - interval '1 day', now() + interval '3 days',
   array['champion', 'technical']),

  -- Contact 2: active deal, warm intro (introduced by Sarah)
  ('00000000-0000-0000-0000-a00000000002',
   '00000000-0000-0000-0000-000000000001',
   'james@globex.io', 'James Rodriguez', 'James', 'Rodriguez',
   'CTO', '00000000-0000-0000-0000-c00000000002',
   'active_deal', 'warm_intro', '00000000-0000-0000-0000-a00000000001', 0.74,
   now() - interval '3 days', now() + interval '1 day',
   array['decision_maker', 'technical']),

  -- Contact 3: keep warm, cold outbound
  ('00000000-0000-0000-0000-a00000000003',
   '00000000-0000-0000-0000-000000000001',
   'priya@initech.com', 'Priya Patel', 'Priya', 'Patel',
   'Director of Product', '00000000-0000-0000-0000-c00000000003',
   'keep_warm', 'cold_outbound', null, 0.45,
   now() - interval '10 days', now() + interval '7 days',
   array['product']),

  -- Contact 4: dormant, event
  ('00000000-0000-0000-0000-a00000000004',
   '00000000-0000-0000-0000-000000000001',
   'mike@example.com', 'Mike Thompson', 'Mike', 'Thompson',
   'Founder & CEO', null,
   'dormant', 'event', null, 0.18,
   now() - interval '45 days', null,
   array['founder', 'saas']),

  -- Contact 5: active deal, inbound
  ('00000000-0000-0000-0000-a00000000005',
   '00000000-0000-0000-0000-000000000001',
   'lisa@acme.com', 'Lisa Wang', 'Lisa', 'Wang',
   'Head of Sales', '00000000-0000-0000-0000-c00000000001',
   'active_deal', 'inbound', null, 0.81,
   now() - interval '2 days', now() + interval '2 days',
   array['decision_maker', 'budget_holder']);

-- =============================================================================
-- Sales pipeline
-- =============================================================================
insert into public.pipelines (id, user_id, name, kind, stages)
values (
  '00000000-0000-0000-0000-p00000000001',
  '00000000-0000-0000-0000-000000000001',
  'Sales Pipeline',
  'sales',
  '[
    {"key": "lead",               "label": "Lead",               "order": 1},
    {"key": "contacted",          "label": "Contacted",          "order": 2},
    {"key": "meeting_scheduled",  "label": "Meeting Scheduled",  "order": 3},
    {"key": "proposal_sent",      "label": "Proposal Sent",      "order": 4},
    {"key": "negotiation",        "label": "Negotiation",        "order": 5},
    {"key": "closed_won",         "label": "Closed Won",         "order": 6},
    {"key": "closed_lost",        "label": "Closed Lost",        "order": 7}
  ]'::jsonb
);

-- Sales pipeline items
insert into public.pipeline_items (pipeline_id, contact_id, stage, value, notes, position)
values
  ('00000000-0000-0000-0000-p00000000001',
   '00000000-0000-0000-0000-a00000000002',
   'meeting_scheduled', 75000.00, 'Demo next week', 0),
  ('00000000-0000-0000-0000-p00000000001',
   '00000000-0000-0000-0000-a00000000005',
   'proposal_sent', 120000.00, 'Waiting on legal review', 0),
  ('00000000-0000-0000-0000-p00000000001',
   '00000000-0000-0000-0000-a00000000003',
   'lead', 50000.00, 'Initial outreach done', 0);

-- =============================================================================
-- Recruiting pipeline
-- =============================================================================
insert into public.pipelines (id, user_id, name, kind, stages)
values (
  '00000000-0000-0000-0000-p00000000002',
  '00000000-0000-0000-0000-000000000001',
  'Recruiting Pipeline',
  'recruiting',
  '[
    {"key": "sourced",       "label": "Sourced",        "order": 1},
    {"key": "reached_out",   "label": "Reached Out",    "order": 2},
    {"key": "responded",     "label": "Responded",      "order": 3},
    {"key": "phone_screen",  "label": "Phone Screen",   "order": 4},
    {"key": "interview",     "label": "Interview",      "order": 5},
    {"key": "offer",         "label": "Offer",          "order": 6},
    {"key": "hired",         "label": "Hired",          "order": 7},
    {"key": "passed",        "label": "Passed",         "order": 8}
  ]'::jsonb
);

-- =============================================================================
-- Interactions (10 sample)
-- =============================================================================
insert into public.interactions
  (user_id, contact_id, channel, direction, subject, body_snippet, sentiment, intent, thread_id, occurred_at)
values
  -- Sarah Chen interactions (inner circle)
  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000001',
   'email', 'inbound',
   'Re: Q2 Roadmap Discussion',
   'Hey Alex, loved the deck. Let''s loop in James from Globex...',
   'positive', 'introduction', 'thread_001',
   now() - interval '1 day'),

  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000001',
   'email', 'outbound',
   'Q2 Roadmap Discussion',
   'Hi Sarah, wanted to share our updated roadmap with you...',
   'positive', 'share_update', 'thread_001',
   now() - interval '2 days'),

  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000001',
   'meeting', 'outbound',
   'Monthly Sync',
   'Covered: product updates, partnership status, Q2 targets.',
   'positive', 'relationship_building', null,
   now() - interval '14 days'),

  -- James Rodriguez interactions (active deal)
  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000002',
   'email', 'inbound',
   'Re: Introduction from Sarah',
   'Thanks for reaching out. Would love to learn more about...',
   'positive', 'interest', 'thread_002',
   now() - interval '3 days'),

  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000002',
   'email', 'outbound',
   'Introduction from Sarah',
   'Hi James, Sarah Chen suggested we connect regarding...',
   'neutral', 'introduction', 'thread_002',
   now() - interval '5 days'),

  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000002',
   'linkedin', 'outbound',
   null,
   'Connected on LinkedIn after Sarah''s intro.',
   'neutral', 'connect', null,
   now() - interval '6 days'),

  -- Priya Patel interactions (keep warm)
  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000003',
   'email', 'outbound',
   'Following up on SaaS Metrics Report',
   'Hi Priya, wanted to share that report I mentioned...',
   'neutral', 'follow_up', 'thread_003',
   now() - interval '10 days'),

  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000003',
   'email', 'inbound',
   'Re: Following up on SaaS Metrics Report',
   'Thanks Alex, will review and get back to you.',
   'neutral', 'acknowledge', 'thread_003',
   now() - interval '9 days'),

  -- Mike Thompson (dormant)
  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000004',
   'meeting', 'outbound',
   'Met at TechCrunch Disrupt',
   'Brief chat about his new startup. Exchanged cards.',
   'positive', 'networking', null,
   now() - interval '45 days'),

  -- Lisa Wang interactions (active deal)
  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000005',
   'email', 'inbound',
   'Re: Proposal - Enterprise Plan',
   'Alex, the team likes the proposal. Just need to run it by legal...',
   'positive', 'deal_progress', 'thread_004',
   now() - interval '2 days');

-- =============================================================================
-- Actions (5 sample cards of different types)
-- =============================================================================
insert into public.actions
  (user_id, contact_id, type, status, priority, title, body, draft_content, due_at)
values
  -- Reply draft for James
  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000002',
   'reply_draft', 'pending', 90,
   'Reply to James Rodriguez',
   'James expressed interest after Sarah''s introduction. Suggest scheduling a demo.',
   'Hi James,

Great to hear you''re interested! I''d love to walk you through a quick demo. Would Thursday at 2pm PT work for you?

Looking forward to it,
Alex',
   now() + interval '1 day'),

  -- Follow up with Priya
  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000003',
   'follow_up', 'pending', 60,
   'Follow up with Priya Patel',
   'It''s been 10 days since Priya said she''d review the report. Time for a gentle nudge.',
   null,
   now()),

  -- Intro request
  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000001',
   'intro_request', 'pending', 70,
   'Ask Sarah for intro to Acme CFO',
   'Sarah is well-connected at Acme. Consider asking for an introduction to the CFO to discuss budget.',
   null,
   now() + interval '3 days'),

  -- Prep brief
  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000005',
   'prep_brief', 'pending', 80,
   'Prepare for Lisa Wang follow-up call',
   'Lisa''s team likes the proposal but legal is reviewing. Prepare talking points for objection handling.',
   null,
   now() + interval '2 days'),

  -- Custom action
  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-a00000000004',
   'custom', 'snoozed', 30,
   'Re-engage Mike Thompson',
   'Haven''t spoken since TechCrunch Disrupt. Consider sending an article or congrats on his funding round.',
   null,
   now() + interval '14 days');
