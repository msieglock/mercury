-- Mercury: PostgreSQL functions and triggers
-- Migration: 00003_functions
-- Description: Utility functions, triggers, and computed helpers

-- =============================================================================
-- 1. update_updated_at() – generic trigger function
-- =============================================================================
create or replace function public.update_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.update_updated_at()
  is 'Sets updated_at to now() on every UPDATE. Attach as a BEFORE UPDATE trigger.';

-- Attach to contacts
create trigger trg_contacts_updated_at
  before update on public.contacts
  for each row
  execute function public.update_updated_at();

-- Attach to pipeline_items
create trigger trg_pipeline_items_updated_at
  before update on public.pipeline_items
  for each row
  execute function public.update_updated_at();

-- =============================================================================
-- 2. get_pending_actions(p_user_id) – action feed ordered by priority
-- =============================================================================
create or replace function public.get_pending_actions(p_user_id uuid)
returns setof public.actions
language sql
stable
security definer
as $$
  select *
  from public.actions
  where user_id = p_user_id
    and status = 'pending'
    and (snoozed_until is null or snoozed_until <= now())
  order by priority desc, created_at asc;
$$;

comment on function public.get_pending_actions(uuid)
  is 'Returns all pending (non-snoozed) actions for a user, highest priority first.';

-- =============================================================================
-- 3. get_contact_with_interactions(p_user_id, p_contact_id) – JSON bundle
-- =============================================================================
create or replace function public.get_contact_with_interactions(
  p_user_id    uuid,
  p_contact_id uuid
)
returns jsonb
language plpgsql
stable
security definer
as $$
declare
  v_contact  jsonb;
  v_interactions jsonb;
  v_company  jsonb;
begin
  -- Fetch contact
  select to_jsonb(c.*) into v_contact
  from public.contacts c
  where c.id = p_contact_id
    and c.user_id = p_user_id;

  if v_contact is null then
    return null;
  end if;

  -- Fetch company if linked
  if (v_contact ->> 'company_id') is not null then
    select to_jsonb(co.*) into v_company
    from public.companies co
    where co.id = (v_contact ->> 'company_id')::uuid;
  end if;

  -- Fetch recent interactions (last 50)
  select coalesce(jsonb_agg(
    to_jsonb(i.*) order by i.occurred_at desc
  ), '[]'::jsonb)
  into v_interactions
  from (
    select *
    from public.interactions
    where contact_id = p_contact_id
      and user_id = p_user_id
    order by occurred_at desc
    limit 50
  ) i;

  return jsonb_build_object(
    'contact',      v_contact,
    'company',      coalesce(v_company, 'null'::jsonb),
    'interactions',  v_interactions,
    'interaction_count', (
      select count(*)
      from public.interactions
      where contact_id = p_contact_id
        and user_id = p_user_id
    )
  );
end;
$$;

comment on function public.get_contact_with_interactions(uuid, uuid)
  is 'Returns a contact, their company, and recent interactions as a single JSON object.';

-- =============================================================================
-- 4. calculate_relationship_score(p_contact_id) – 0..1 score
-- =============================================================================
create or replace function public.calculate_relationship_score(p_contact_id uuid)
returns real
language plpgsql
stable
security definer
as $$
declare
  v_count         integer;
  v_recency_days  real;
  v_positive_ratio real;
  v_count_score   real;
  v_recency_score real;
  v_sentiment_score real;
  v_final_score   real;
begin
  -- Total interaction count
  select count(*)
  into v_count
  from public.interactions
  where contact_id = p_contact_id;

  -- If zero interactions, score is 0
  if v_count = 0 then
    return 0.0;
  end if;

  -- Days since last interaction
  select extract(epoch from (now() - max(occurred_at))) / 86400.0
  into v_recency_days
  from public.interactions
  where contact_id = p_contact_id;

  -- Positive sentiment ratio
  select coalesce(
    count(*) filter (where sentiment = 'positive')::real / nullif(count(*), 0)::real,
    0.5
  )
  into v_positive_ratio
  from public.interactions
  where contact_id = p_contact_id
    and sentiment is not null;

  -- Count score: logarithmic scale, capped at 1.0 (30+ interactions = 1.0)
  v_count_score := least(ln(v_count + 1) / ln(31), 1.0);

  -- Recency score: exponential decay, half-life = 14 days
  v_recency_score := exp(-0.693 * v_recency_days / 14.0);

  -- Sentiment score: 0..1 based on positive ratio
  v_sentiment_score := v_positive_ratio;

  -- Weighted combination: 40% count, 35% recency, 25% sentiment
  v_final_score := (0.40 * v_count_score)
                 + (0.35 * v_recency_score)
                 + (0.25 * v_sentiment_score);

  -- Clamp to [0, 1]
  return greatest(0.0, least(v_final_score, 1.0));
end;
$$;

comment on function public.calculate_relationship_score(uuid)
  is 'Computes a 0-1 relationship score based on interaction count, recency, and sentiment.';

-- =============================================================================
-- 5. get_pipeline_summary(p_pipeline_id) – stage counts & values
-- =============================================================================
create or replace function public.get_pipeline_summary(p_pipeline_id uuid)
returns jsonb
language plpgsql
stable
security definer
as $$
declare
  v_pipeline jsonb;
  v_stages   jsonb;
begin
  -- Fetch pipeline metadata
  select to_jsonb(p.*) into v_pipeline
  from public.pipelines p
  where p.id = p_pipeline_id;

  if v_pipeline is null then
    return null;
  end if;

  -- Aggregate stage counts and total values
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'stage',       s.stage,
      'item_count',  s.item_count,
      'total_value', s.total_value
    )
  ), '[]'::jsonb)
  into v_stages
  from (
    select
      pi.stage,
      count(*)              as item_count,
      coalesce(sum(pi.value), 0) as total_value
    from public.pipeline_items pi
    where pi.pipeline_id = p_pipeline_id
    group by pi.stage
    order by pi.stage
  ) s;

  return jsonb_build_object(
    'pipeline_id',   p_pipeline_id,
    'pipeline_name', v_pipeline ->> 'name',
    'kind',          v_pipeline ->> 'kind',
    'stages',        v_stages,
    'total_items',   (
      select count(*) from public.pipeline_items
      where pipeline_id = p_pipeline_id
    ),
    'total_value',   (
      select coalesce(sum(value), 0) from public.pipeline_items
      where pipeline_id = p_pipeline_id
    )
  );
end;
$$;

comment on function public.get_pipeline_summary(uuid)
  is 'Returns stage-level counts and summed values for a pipeline.';
