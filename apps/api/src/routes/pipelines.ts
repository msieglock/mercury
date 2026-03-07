import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../middleware/auth.js';
import { getUserId } from '../middleware/auth.js';
import { getServiceClient } from '../lib/supabase.js';

const pipelines = new Hono<AuthEnv>();

// ─── Schemas ────────────────────────────────────────────────────────────────

const createPipelineSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['sales', 'recruiting']),
  stages: z.array(z.string().min(1)).min(2).max(20),
});

const updatePipelineItemSchema = z.object({
  stage: z.string().optional(),
  position: z.number().int().min(0).optional(),
  value: z.number().optional(),
  expected_close_at: z.string().datetime().optional(),
  notes: z.string().optional(),
});

// ─── GET /pipelines ─────────────────────────────────────────────────────────

pipelines.get('/', async (c) => {
  const userId = getUserId(c);

  try {
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from('pipelines')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return c.json({ error: 'Failed to fetch pipelines' }, 500);
    }

    return c.json({ pipelines: data ?? [] });
  } catch (error) {
    console.error('[pipelines] Failed to fetch pipelines:', error);
    return c.json({ error: 'Failed to fetch pipelines' }, 500);
  }
});

// ─── POST /pipelines ────────────────────────────────────────────────────────

pipelines.post('/', async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json();
  const parsed = createPipelineSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { name, type, stages } = parsed.data;

  try {
    const supabase = getServiceClient();

    // Check if user already has a default pipeline of this type
    const { data: existingDefault } = await supabase
      .from('pipelines')
      .select('id')
      .eq('user_id', userId)
      .eq('type', type)
      .eq('is_default', true)
      .maybeSingle();

    const { data: pipeline, error } = await supabase
      .from('pipelines')
      .insert({
        user_id: userId,
        name,
        type,
        stages,
        is_default: !existingDefault, // First pipeline of this type becomes default
      })
      .select()
      .single();

    if (error) {
      return c.json({ error: 'Failed to create pipeline' }, 500);
    }

    return c.json({ pipeline }, 201);
  } catch (error) {
    console.error('[pipelines] Failed to create pipeline:', error);
    return c.json({ error: 'Failed to create pipeline' }, 500);
  }
});

// ─── GET /pipelines/:id/items ───────────────────────────────────────────────

pipelines.get('/:id/items', async (c) => {
  const userId = getUserId(c);
  const pipelineId = c.req.param('id');

  try {
    const supabase = getServiceClient();

    // Verify pipeline belongs to user
    const { data: pipeline, error: pipelineError } = await supabase
      .from('pipelines')
      .select('*')
      .eq('id', pipelineId)
      .eq('user_id', userId)
      .single();

    if (pipelineError || !pipeline) {
      return c.json({ error: 'Pipeline not found' }, 404);
    }

    // Fetch items with contact data
    const { data: items, error: itemsError } = await supabase
      .from('pipeline_items')
      .select('*, contacts(id, full_name, title, email, avatar_url, company_id, companies(id, name))')
      .eq('pipeline_id', pipelineId)
      .order('position', { ascending: true });

    if (itemsError) {
      return c.json({ error: 'Failed to fetch pipeline items' }, 500);
    }

    // Group items by stage
    const stages: Record<string, typeof items> = {};
    for (const stage of pipeline.stages) {
      stages[stage] = [];
    }

    for (const item of items ?? []) {
      if (stages[item.stage]) {
        stages[item.stage].push(item);
      } else {
        // Item in an unknown stage -- put in first stage
        stages[pipeline.stages[0]]?.push(item);
      }
    }

    return c.json({
      pipeline,
      stages,
      total_items: (items ?? []).length,
    });
  } catch (error) {
    console.error('[pipelines] Failed to fetch pipeline items:', error);
    return c.json({ error: 'Failed to fetch pipeline items' }, 500);
  }
});

// ─── PATCH /pipeline-items/:id ──────────────────────────────────────────────

pipelines.patch('/items/:id', async (c) => {
  const userId = getUserId(c);
  const itemId = c.req.param('id');
  const body = await c.req.json();
  const parsed = updatePipelineItemSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  try {
    const supabase = getServiceClient();

    // Verify item belongs to a pipeline owned by this user
    const { data: item, error: itemError } = await supabase
      .from('pipeline_items')
      .select('*, pipelines!inner(user_id)')
      .eq('id', itemId)
      .single();

    if (itemError || !item) {
      return c.json({ error: 'Pipeline item not found' }, 404);
    }

    if ((item as unknown as { pipelines: { user_id: string } }).pipelines.user_id !== userId) {
      return c.json({ error: 'Pipeline item not found' }, 404);
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.stage !== undefined) updates.stage = parsed.data.stage;
    if (parsed.data.position !== undefined) updates.position = parsed.data.position;
    if (parsed.data.value !== undefined) updates.value = parsed.data.value;
    if (parsed.data.expected_close_at !== undefined) updates.expected_close_at = parsed.data.expected_close_at;
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;

    const { data: updated, error: updateError } = await supabase
      .from('pipeline_items')
      .update(updates)
      .eq('id', itemId)
      .select('*, contacts(id, full_name, title, email)')
      .single();

    if (updateError) {
      return c.json({ error: 'Failed to update pipeline item' }, 500);
    }

    return c.json({ item: updated });
  } catch (error) {
    console.error('[pipelines] Failed to update pipeline item:', error);
    return c.json({ error: 'Failed to update pipeline item' }, 500);
  }
});

export default pipelines;
