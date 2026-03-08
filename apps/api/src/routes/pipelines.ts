import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../middleware/auth.js';
import { getUserId } from '../middleware/auth.js';

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
  notes: z.string().optional(),
});

// ─── GET /pipelines ─────────────────────────────────────────────────────────

pipelines.get('/', async (c) => {
  const userId = getUserId(c);

  try {
    const db = c.env.DB;

    const result = await db
      .prepare('SELECT * FROM pipelines WHERE user_id = ? ORDER BY created_at DESC')
      .bind(userId)
      .all();

    // Parse JSON fields
    const pipelinesData = (result.results ?? []).map((p) => ({
      ...p,
      stages: typeof p.stages === 'string' ? JSON.parse(p.stages as string) : p.stages,
    }));

    return c.json({ pipelines: pipelinesData });
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
    const db = c.env.DB;

    const pipelineId = crypto.randomUUID();

    await db
      .prepare(
        `INSERT INTO pipelines (id, user_id, name, kind, stages, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        pipelineId,
        userId,
        name,
        type,
        JSON.stringify(stages),
        new Date().toISOString(),
        new Date().toISOString()
      )
      .run();

    const pipeline = await db
      .prepare('SELECT * FROM pipelines WHERE id = ?')
      .bind(pipelineId)
      .first();

    return c.json({
      pipeline: {
        ...pipeline,
        stages: typeof pipeline?.stages === 'string' ? JSON.parse(pipeline.stages as string) : pipeline?.stages,
      },
    }, 201);
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
    const db = c.env.DB;

    // Verify pipeline belongs to user
    const pipeline = await db
      .prepare('SELECT * FROM pipelines WHERE id = ? AND user_id = ?')
      .bind(pipelineId, userId)
      .first();

    if (!pipeline) {
      return c.json({ error: 'Pipeline not found' }, 404);
    }

    const pipelineStages = typeof pipeline.stages === 'string'
      ? JSON.parse(pipeline.stages as string) as string[]
      : pipeline.stages as string[];

    // Fetch items with contact data
    const itemsResult = await db
      .prepare(
        `SELECT pi.*,
                c.id as contact_id_ref, c.full_name as contact_full_name, c.title as contact_title,
                c.email as contact_email, c.avatar_url as contact_avatar_url, c.company_id as contact_company_id,
                co.id as company_id_ref, co.name as company_name
         FROM pipeline_items pi
         LEFT JOIN contacts c ON pi.contact_id = c.id
         LEFT JOIN companies co ON c.company_id = co.id
         WHERE pi.pipeline_id = ?
         ORDER BY pi.position ASC`
      )
      .bind(pipelineId)
      .all();

    const items = (itemsResult.results ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: r.id,
        pipeline_id: r.pipeline_id,
        contact_id: r.contact_id,
        stage: r.stage as string,
        position: r.position,
        value: r.value,
        expected_close_at: r.expected_close_at,
        notes: r.notes,
        created_at: r.created_at,
        updated_at: r.updated_at,
        contacts: r.contact_id_ref ? {
          id: r.contact_id_ref,
          full_name: r.contact_full_name,
          title: r.contact_title,
          email: r.contact_email,
          avatar_url: r.contact_avatar_url,
          company_id: r.contact_company_id,
          companies: r.company_id_ref ? { id: r.company_id_ref, name: r.company_name } : null,
        } : null,
      };
    });

    // Group items by stage
    const stages: Record<string, typeof items> = {};
    for (const stage of pipelineStages) {
      stages[stage] = [];
    }

    for (const item of items) {
      const itemStage = item.stage;
      if (stages[itemStage]) {
        stages[itemStage].push(item);
      } else {
        // Item in an unknown stage -- put in first stage
        stages[pipelineStages[0]]?.push(item);
      }
    }

    return c.json({
      pipeline: {
        ...pipeline,
        stages: pipelineStages,
      },
      stages,
      total_items: items.length,
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
    const db = c.env.DB;

    // Verify item belongs to a pipeline owned by this user
    const item = await db
      .prepare(
        `SELECT pi.*, p.user_id as pipeline_user_id
         FROM pipeline_items pi
         JOIN pipelines p ON pi.pipeline_id = p.id
         WHERE pi.id = ?`
      )
      .bind(itemId)
      .first();

    if (!item) {
      return c.json({ error: 'Pipeline item not found' }, 404);
    }

    if ((item.pipeline_user_id as string) !== userId) {
      return c.json({ error: 'Pipeline item not found' }, 404);
    }

    const setClauses: string[] = ['updated_at = ?'];
    const values: unknown[] = [new Date().toISOString()];

    if (parsed.data.stage !== undefined) {
      setClauses.push('stage = ?');
      values.push(parsed.data.stage);
    }
    if (parsed.data.position !== undefined) {
      setClauses.push('position = ?');
      values.push(parsed.data.position);
    }
    if (parsed.data.value !== undefined) {
      setClauses.push('value = ?');
      values.push(parsed.data.value);
    }
    if (parsed.data.notes !== undefined) {
      setClauses.push('notes = ?');
      values.push(parsed.data.notes);
    }

    values.push(itemId);

    const updated = await db
      .prepare(
        `UPDATE pipeline_items SET ${setClauses.join(', ')} WHERE id = ? RETURNING *`
      )
      .bind(...values)
      .first();

    // Fetch contact info for the updated item
    let contactData: Record<string, unknown> | null = null;
    if (updated?.contact_id) {
      contactData = await db
        .prepare('SELECT id, full_name, title, email FROM contacts WHERE id = ?')
        .bind(updated.contact_id as string)
        .first();
    }

    return c.json({
      item: {
        ...updated,
        contacts: contactData,
      },
    });
  } catch (error) {
    console.error('[pipelines] Failed to update pipeline item:', error);
    return c.json({ error: 'Failed to update pipeline item' }, 500);
  }
});

export default pipelines;
