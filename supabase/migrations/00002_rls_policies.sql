-- Mercury: Row Level Security policies
-- Migration: 00002_rls_policies
-- Description: Enables RLS on all tables and creates access policies

-- =============================================================================
-- Enable RLS on every table
-- =============================================================================
alter table public.users           enable row level security;
alter table public.linked_accounts enable row level security;
alter table public.contacts        enable row level security;
alter table public.companies       enable row level security;
alter table public.interactions    enable row level security;
alter table public.actions         enable row level security;
alter table public.pipelines       enable row level security;
alter table public.pipeline_items  enable row level security;
alter table public.agent_logs      enable row level security;
alter table public.style_edits     enable row level security;

-- =============================================================================
-- USERS – read & update own record only
-- =============================================================================
create policy "users_select_own"
  on public.users for select
  using (id = auth.uid());

create policy "users_update_own"
  on public.users for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- =============================================================================
-- LINKED ACCOUNTS – full CRUD on own records
-- =============================================================================
create policy "linked_accounts_select_own"
  on public.linked_accounts for select
  using (user_id = auth.uid());

create policy "linked_accounts_insert_own"
  on public.linked_accounts for insert
  with check (user_id = auth.uid());

create policy "linked_accounts_update_own"
  on public.linked_accounts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "linked_accounts_delete_own"
  on public.linked_accounts for delete
  using (user_id = auth.uid());

-- =============================================================================
-- CONTACTS – full CRUD on own records
-- =============================================================================
create policy "contacts_select_own"
  on public.contacts for select
  using (user_id = auth.uid());

create policy "contacts_insert_own"
  on public.contacts for insert
  with check (user_id = auth.uid());

create policy "contacts_update_own"
  on public.contacts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "contacts_delete_own"
  on public.contacts for delete
  using (user_id = auth.uid());

-- =============================================================================
-- COMPANIES – full CRUD on own records
-- =============================================================================
create policy "companies_select_own"
  on public.companies for select
  using (user_id = auth.uid());

create policy "companies_insert_own"
  on public.companies for insert
  with check (user_id = auth.uid());

create policy "companies_update_own"
  on public.companies for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "companies_delete_own"
  on public.companies for delete
  using (user_id = auth.uid());

-- =============================================================================
-- INTERACTIONS – full CRUD on own records
-- =============================================================================
create policy "interactions_select_own"
  on public.interactions for select
  using (user_id = auth.uid());

create policy "interactions_insert_own"
  on public.interactions for insert
  with check (user_id = auth.uid());

create policy "interactions_update_own"
  on public.interactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "interactions_delete_own"
  on public.interactions for delete
  using (user_id = auth.uid());

-- =============================================================================
-- ACTIONS – full CRUD on own records
-- =============================================================================
create policy "actions_select_own"
  on public.actions for select
  using (user_id = auth.uid());

create policy "actions_insert_own"
  on public.actions for insert
  with check (user_id = auth.uid());

create policy "actions_update_own"
  on public.actions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "actions_delete_own"
  on public.actions for delete
  using (user_id = auth.uid());

-- =============================================================================
-- PIPELINES – full CRUD on own records
-- =============================================================================
create policy "pipelines_select_own"
  on public.pipelines for select
  using (user_id = auth.uid());

create policy "pipelines_insert_own"
  on public.pipelines for insert
  with check (user_id = auth.uid());

create policy "pipelines_update_own"
  on public.pipelines for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "pipelines_delete_own"
  on public.pipelines for delete
  using (user_id = auth.uid());

-- =============================================================================
-- PIPELINE ITEMS – CRUD via pipeline ownership
-- Pipeline items don't have a direct user_id; access is checked through the
-- parent pipeline's user_id.
-- =============================================================================
create policy "pipeline_items_select_own"
  on public.pipeline_items for select
  using (
    exists (
      select 1 from public.pipelines
      where pipelines.id = pipeline_items.pipeline_id
        and pipelines.user_id = auth.uid()
    )
  );

create policy "pipeline_items_insert_own"
  on public.pipeline_items for insert
  with check (
    exists (
      select 1 from public.pipelines
      where pipelines.id = pipeline_items.pipeline_id
        and pipelines.user_id = auth.uid()
    )
  );

create policy "pipeline_items_update_own"
  on public.pipeline_items for update
  using (
    exists (
      select 1 from public.pipelines
      where pipelines.id = pipeline_items.pipeline_id
        and pipelines.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pipelines
      where pipelines.id = pipeline_items.pipeline_id
        and pipelines.user_id = auth.uid()
    )
  );

create policy "pipeline_items_delete_own"
  on public.pipeline_items for delete
  using (
    exists (
      select 1 from public.pipelines
      where pipelines.id = pipeline_items.pipeline_id
        and pipelines.user_id = auth.uid()
    )
  );

-- =============================================================================
-- AGENT LOGS – full CRUD on own records
-- =============================================================================
create policy "agent_logs_select_own"
  on public.agent_logs for select
  using (user_id = auth.uid());

create policy "agent_logs_insert_own"
  on public.agent_logs for insert
  with check (user_id = auth.uid());

create policy "agent_logs_update_own"
  on public.agent_logs for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "agent_logs_delete_own"
  on public.agent_logs for delete
  using (user_id = auth.uid());

-- =============================================================================
-- STYLE EDITS – full CRUD on own records
-- =============================================================================
create policy "style_edits_select_own"
  on public.style_edits for select
  using (user_id = auth.uid());

create policy "style_edits_insert_own"
  on public.style_edits for insert
  with check (user_id = auth.uid());

create policy "style_edits_update_own"
  on public.style_edits for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "style_edits_delete_own"
  on public.style_edits for delete
  using (user_id = auth.uid());

-- =============================================================================
-- SERVICE ROLE BYPASS
-- The Supabase service_role key automatically bypasses RLS. These explicit
-- policies ensure that background jobs using the service role can access all
-- rows without restriction, even if the default behaviour changes.
-- =============================================================================
create policy "service_role_bypass_users"
  on public.users for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service_role_bypass_linked_accounts"
  on public.linked_accounts for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service_role_bypass_contacts"
  on public.contacts for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service_role_bypass_companies"
  on public.companies for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service_role_bypass_interactions"
  on public.interactions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service_role_bypass_actions"
  on public.actions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service_role_bypass_pipelines"
  on public.pipelines for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service_role_bypass_pipeline_items"
  on public.pipeline_items for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service_role_bypass_agent_logs"
  on public.agent_logs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service_role_bypass_style_edits"
  on public.style_edits for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
