import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../middleware/auth.js';
import { getUserId } from '../middleware/auth.js';

const sequences = new Hono<AuthEnv>();

// ─── Schemas ────────────────────────────────────────────────────────────────

const createSequenceSchema = z.object({
  name: z.string().min(1),
  trigger_type: z.enum(['manual', 'segment_enter', 'no_reply']).optional(),
  steps: z.array(z.object({
    delay_days: z.number().min(0),
    channel: z.enum(['email', 'sms', 'linkedin']).optional(),
    template: z.string(),
    subject: z.string().optional(),
  })),
});

const enrollSchema = z.object({
  contact_ids: z.array(z.string().uuid()),
});

// ─── GET /sequences ─────────────────────────────────────────────────────────

sequences.get('/', async (c) => {
  const userId = getUserId(c);

  try {
    const db = c.env.DB;

    const result = await db
      .prepare(
        `SELECT s.*,
                (SELECT COUNT(*) FROM sequence_enrollments se WHERE se.sequence_id = s.id AND se.status = 'active') as active_enrollments,
                (SELECT COUNT(*) FROM sequence_steps ss WHERE ss.sequence_id = s.id) as step_count
         FROM sequences s
         WHERE s.user_id = ? AND s.status != 'archived'
         ORDER BY s.created_at DESC`
      )
      .bind(userId)
      .all();

    return c.json({ sequences: result.results ?? [] });
  } catch (error) {
    console.error('[sequences] Failed to fetch:', error);
    return c.json({ error: 'Failed to fetch sequences' }, 500);
  }
});

// ─── GET /sequences/:id ─────────────────────────────────────────────────────

sequences.get('/:id', async (c) => {
  const userId = getUserId(c);
  const seqId = c.req.param('id');

  try {
    const db = c.env.DB;

    const sequence = await db
      .prepare('SELECT * FROM sequences WHERE id = ? AND user_id = ?')
      .bind(seqId, userId)
      .first();

    if (!sequence) return c.json({ error: 'Sequence not found' }, 404);

    const [stepsResult, enrollmentsResult] = await Promise.all([
      db.prepare('SELECT * FROM sequence_steps WHERE sequence_id = ? ORDER BY step_order')
        .bind(seqId).all(),
      db.prepare(
        `SELECT se.*, c.full_name as contact_name, c.email as contact_email
         FROM sequence_enrollments se
         LEFT JOIN contacts c ON se.contact_id = c.id
         WHERE se.sequence_id = ?
         ORDER BY se.created_at DESC`
      ).bind(seqId).all(),
    ]);

    return c.json({
      sequence,
      steps: stepsResult.results ?? [],
      enrollments: enrollmentsResult.results ?? [],
    });
  } catch (error) {
    console.error('[sequences] Failed to fetch sequence:', error);
    return c.json({ error: 'Failed to fetch sequence' }, 500);
  }
});

// ─── POST /sequences ────────────────────────────────────────────────────────

sequences.post('/', async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json();
  const parsed = createSequenceSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  try {
    const db = c.env.DB;
    const seqId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO sequences (id, user_id, name, trigger_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(seqId, userId, parsed.data.name, parsed.data.trigger_type ?? 'manual', now, now)
      .run();

    for (let i = 0; i < parsed.data.steps.length; i++) {
      const step = parsed.data.steps[i];
      await db
        .prepare(
          `INSERT INTO sequence_steps (id, sequence_id, step_order, delay_days, channel, template, subject, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(), seqId, i, step.delay_days,
          step.channel ?? 'email', step.template, step.subject ?? null, now
        )
        .run();
    }

    return c.json({ id: seqId, success: true }, 201);
  } catch (error) {
    console.error('[sequences] Failed to create:', error);
    return c.json({ error: 'Failed to create sequence' }, 500);
  }
});

// ─── POST /sequences/:id/enroll ─────────────────────────────────────────────

sequences.post('/:id/enroll', async (c) => {
  const userId = getUserId(c);
  const seqId = c.req.param('id');
  const body = await c.req.json();
  const parsed = enrollSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  try {
    const db = c.env.DB;

    // Verify sequence belongs to user
    const seq = await db
      .prepare('SELECT id FROM sequences WHERE id = ? AND user_id = ?')
      .bind(seqId, userId)
      .first();

    if (!seq) return c.json({ error: 'Sequence not found' }, 404);

    // Get first step to calculate next_step_at
    const firstStep = await db
      .prepare('SELECT delay_days FROM sequence_steps WHERE sequence_id = ? ORDER BY step_order LIMIT 1')
      .bind(seqId)
      .first<{ delay_days: number }>();

    const now = new Date();
    const nextStepAt = new Date(now.getTime() + (firstStep?.delay_days ?? 0) * 24 * 60 * 60 * 1000).toISOString();

    let enrolled = 0;
    for (const contactId of parsed.data.contact_ids) {
      try {
        await db
          .prepare(
            `INSERT INTO sequence_enrollments (id, sequence_id, contact_id, user_id, current_step, status, next_step_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, 0, 'active', ?, ?, ?)`
          )
          .bind(crypto.randomUUID(), seqId, contactId, userId, nextStepAt, now.toISOString(), now.toISOString())
          .run();
        enrolled++;
      } catch {
        // UNIQUE constraint — already enrolled
      }
    }

    return c.json({ enrolled, total: parsed.data.contact_ids.length });
  } catch (error) {
    console.error('[sequences] Failed to enroll:', error);
    return c.json({ error: 'Failed to enroll contacts' }, 500);
  }
});

// ─── PATCH /sequences/:id ───────────────────────────────────────────────────

sequences.patch('/:id', async (c) => {
  const userId = getUserId(c);
  const seqId = c.req.param('id');
  const body = await c.req.json();

  try {
    const db = c.env.DB;
    const setClauses: string[] = ['updated_at = ?'];
    const values: unknown[] = [new Date().toISOString()];

    if (body.name) { setClauses.push('name = ?'); values.push(body.name); }
    if (body.status) { setClauses.push('status = ?'); values.push(body.status); }

    values.push(seqId, userId);

    await db
      .prepare(`UPDATE sequences SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`)
      .bind(...values)
      .run();

    return c.json({ success: true });
  } catch (error) {
    console.error('[sequences] Failed to update:', error);
    return c.json({ error: 'Failed to update sequence' }, 500);
  }
});

export default sequences;
