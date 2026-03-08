import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/auth.js';
import { getUserId } from '../middleware/auth.js';

const analytics = new Hono<AuthEnv>();

// ─── GET /analytics ─────────────────────────────────────────────────────────

analytics.get('/', async (c) => {
  const userId = getUserId(c);

  try {
    const db = c.env.DB;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      pipelineValue,
      contactGrowth,
      responseTime,
      interactionsByChannel,
      actionCompletion,
      aiUsage,
      contactsBySegment,
      weeklyActivity,
    ] = await Promise.all([
      // Pipeline value
      db.prepare(
        `SELECT COALESCE(SUM(pi.value), 0) as total_value, COUNT(*) as deal_count
         FROM pipeline_items pi
         JOIN pipelines p ON pi.pipeline_id = p.id
         WHERE p.user_id = ?`
      ).bind(userId).first<{ total_value: number; deal_count: number }>(),

      // Contact growth (last 30 days)
      db.prepare(
        `SELECT COUNT(*) as new_contacts
         FROM contacts WHERE user_id = ? AND created_at >= ?`
      ).bind(userId, thirtyDaysAgo).first<{ new_contacts: number }>(),

      // Avg response time (outbound after inbound, last 30 days)
      db.prepare(
        `SELECT AVG(
           CAST((julianday(outbound.occurred_at) - julianday(inbound.occurred_at)) * 24 AS REAL)
         ) as avg_hours
         FROM interactions inbound
         JOIN interactions outbound ON inbound.contact_id = outbound.contact_id
           AND outbound.direction = 'outbound'
           AND outbound.occurred_at > inbound.occurred_at
           AND julianday(outbound.occurred_at) - julianday(inbound.occurred_at) < 7
         WHERE inbound.user_id = ? AND inbound.direction = 'inbound'
           AND inbound.occurred_at >= ?
         LIMIT 500`
      ).bind(userId, thirtyDaysAgo).first<{ avg_hours: number | null }>(),

      // Interactions by channel (last 30 days)
      db.prepare(
        `SELECT channel, direction, COUNT(*) as count
         FROM interactions
         WHERE user_id = ? AND occurred_at >= ?
         GROUP BY channel, direction`
      ).bind(userId, thirtyDaysAgo).all(),

      // Action completion rate (last 30 days)
      db.prepare(
        `SELECT status, COUNT(*) as count
         FROM actions
         WHERE user_id = ? AND created_at >= ?
         GROUP BY status`
      ).bind(userId, thirtyDaysAgo).all(),

      // AI usage (last 30 days)
      db.prepare(
        `SELECT COUNT(*) as total_calls,
                SUM(input_tokens + output_tokens) as total_tokens,
                AVG(latency_ms) as avg_latency
         FROM agent_logs
         WHERE user_id = ? AND created_at >= ?`
      ).bind(userId, thirtyDaysAgo).first<{ total_calls: number; total_tokens: number; avg_latency: number }>(),

      // Contacts by segment
      db.prepare(
        `SELECT segment, COUNT(*) as count
         FROM contacts WHERE user_id = ?
         GROUP BY segment`
      ).bind(userId).all(),

      // Weekly activity (last 7 days, per day)
      db.prepare(
        `SELECT DATE(occurred_at) as day, COUNT(*) as count, direction
         FROM interactions
         WHERE user_id = ? AND occurred_at >= ?
         GROUP BY DATE(occurred_at), direction
         ORDER BY day`
      ).bind(userId, sevenDaysAgo).all(),
    ]);

    // Parse action completion
    const actionStats = (actionCompletion.results ?? []).reduce(
      (acc, row) => {
        acc[row.status as string] = row.count as number;
        return acc;
      },
      {} as Record<string, number>
    );
    const totalActions = Object.values(actionStats).reduce((s, c) => s + c, 0);
    const completedActions = (actionStats['done'] ?? 0) + (actionStats['dismissed'] ?? 0);

    // Parse channel stats
    const channelStats: Record<string, { inbound: number; outbound: number }> = {};
    for (const row of interactionsByChannel.results ?? []) {
      const ch = row.channel as string;
      if (!channelStats[ch]) channelStats[ch] = { inbound: 0, outbound: 0 };
      channelStats[ch][row.direction as 'inbound' | 'outbound'] = row.count as number;
    }

    // Parse segment breakdown
    const segmentBreakdown: Record<string, number> = {};
    for (const row of contactsBySegment.results ?? []) {
      segmentBreakdown[row.segment as string] = row.count as number;
    }

    return c.json({
      pipeline: {
        total_value: pipelineValue?.total_value ?? 0,
        deal_count: pipelineValue?.deal_count ?? 0,
      },
      contacts: {
        new_last_30d: contactGrowth?.new_contacts ?? 0,
        by_segment: segmentBreakdown,
      },
      response_time: {
        avg_hours: responseTime?.avg_hours ? Math.round(responseTime.avg_hours * 10) / 10 : null,
      },
      interactions: {
        by_channel: channelStats,
      },
      actions: {
        total: totalActions,
        completed: completedActions,
        completion_rate: totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0,
        by_status: actionStats,
      },
      ai: {
        total_calls: aiUsage?.total_calls ?? 0,
        total_tokens: aiUsage?.total_tokens ?? 0,
        avg_latency_ms: aiUsage?.avg_latency ? Math.round(aiUsage.avg_latency) : null,
      },
      weekly_activity: weeklyActivity.results ?? [],
    });
  } catch (error) {
    console.error('[analytics] Failed to fetch analytics:', error);
    return c.json({ error: 'Failed to fetch analytics' }, 500);
  }
});

export default analytics;
