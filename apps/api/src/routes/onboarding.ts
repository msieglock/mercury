import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../middleware/auth.js';
import { getUserId } from '../middleware/auth.js';
import { aiGateway } from '../lib/ai-gateway.js';
import { searchPeople } from '../lib/apollo.js';

const onboarding = new Hono<AuthEnv>();

// ─── Schemas ────────────────────────────────────────────────────────────────

const icpSchema = z.object({
  target_titles: z.array(z.string()).min(1),
  target_industries: z.array(z.string()).optional(),
  target_company_sizes: z.array(z.string()).optional(),
  target_locations: z.array(z.string()).optional(),
  description: z.string().optional(),
});

const discoverSchema = z.object({
  max_results: z.number().int().min(1).max(100).optional(),
});

// ─── POST /onboarding/start ─────────────────────────────────────────────────

onboarding.post('/start', async (c) => {
  const userId = getUserId(c);

  try {
    const db = c.env.DB;

    // Verify user exists
    const user = await db
      .prepare('SELECT id, onboarding_completed FROM users WHERE id = ?')
      .bind(userId)
      .first();

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Check for linked Google account
    const linkedAccount = await db
      .prepare(
        'SELECT id FROM linked_accounts WHERE user_id = ? AND provider = ?'
      )
      .bind(userId, 'google')
      .first();

    // Log onboarding start
    await db
      .prepare(
        `INSERT INTO agent_logs (id, user_id, action, model, input_tokens, output_tokens, latency_ms, request_body, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        userId,
        'onboarding_started',
        'system',
        0,
        0,
        0,
        JSON.stringify({ google_linked: !!linkedAccount }),
        new Date().toISOString()
      )
      .run();

    // Update user timestamp
    await db
      .prepare('UPDATE users SET updated_at = ? WHERE id = ?')
      .bind(new Date().toISOString(), userId)
      .run();

    return c.json({
      success: true,
      google_linked: !!linkedAccount,
      message: 'Onboarding started. Use /sync/email to pull emails, then poll /onboarding/status for progress.',
    });
  } catch (error) {
    console.error('[onboarding/start] Failed:', error);
    return c.json({ error: 'Failed to start onboarding' }, 500);
  }
});

// ─── GET /onboarding/status ─────────────────────────────────────────────────

onboarding.get('/status', async (c) => {
  const userId = getUserId(c);

  try {
    const db = c.env.DB;

    // Check various onboarding progress indicators
    const [contactsResult, interactionsResult, linkedAccountResult, userResult] =
      await Promise.all([
        db
          .prepare('SELECT COUNT(*) as count FROM contacts WHERE user_id = ?')
          .bind(userId)
          .first<{ count: number }>(),
        db
          .prepare('SELECT COUNT(*) as count FROM interactions WHERE user_id = ?')
          .bind(userId)
          .first<{ count: number }>(),
        db
          .prepare('SELECT provider FROM linked_accounts WHERE user_id = ?')
          .bind(userId)
          .all(),
        db
          .prepare('SELECT settings, onboarding FROM users WHERE id = ?')
          .bind(userId)
          .first(),
      ]);

    const contactCount = contactsResult?.count ?? 0;
    const interactionCount = interactionsResult?.count ?? 0;
    const linkedAccounts = linkedAccountResult.results ?? [];
    const user = userResult;

    const onboardingData = user?.onboarding
      ? typeof user.onboarding === 'string' ? JSON.parse(user.onboarding as string) : user.onboarding
      : {};

    const steps = {
      google_connected: linkedAccounts.some(
        (a) => a.provider === 'google'
      ),
      email_synced: interactionCount > 0,
      contacts_imported: contactCount > 0,
      contacts_enriched: contactCount > 5,
      style_analyzed: false,
      icp_set: false,
      onboarding_completed: !!(onboardingData?.completed),
    };

    const completedSteps = Object.values(steps).filter(Boolean).length;
    const totalSteps = Object.keys(steps).length;

    return c.json({
      progress: Math.round((completedSteps / totalSteps) * 100),
      steps,
      stats: {
        contacts: contactCount,
        interactions: interactionCount,
        linked_accounts: linkedAccounts.length,
      },
    });
  } catch (error) {
    console.error('[onboarding/status] Failed:', error);
    return c.json({ error: 'Failed to fetch onboarding status' }, 500);
  }
});

// ─── POST /onboarding/icp ───────────────────────────────────────────────────

onboarding.post('/icp', async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json();
  const parsed = icpSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  try {
    const db = c.env.DB;

    // Store ICP preferences in agent_logs
    await db
      .prepare(
        `INSERT INTO agent_logs (id, user_id, agent_type, action, input, tokens_used, model, cost_cents, duration_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        userId,
        'orchestrator',
        'icp_saved',
        JSON.stringify(parsed.data),
        0,
        'system',
        0,
        0,
        new Date().toISOString()
      )
      .run();

    return c.json({
      success: true,
      icp: parsed.data,
    });
  } catch (error) {
    console.error('[onboarding/icp] Failed:', error);
    return c.json({ error: 'Failed to save ICP' }, 500);
  }
});

// ─── POST /onboarding/discover ──────────────────────────────────────────────

onboarding.post('/discover', async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json().catch(() => ({}));
  const parsed = discoverSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const maxResults = parsed.data.max_results ?? 25;

  try {
    const db = c.env.DB;

    // 1. Mine inbox for stalled deals -- contacts with old last_interaction_at
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const stalledResult = await db
      .prepare(
        `SELECT c.id, c.full_name, c.email, c.title, c.segment, c.last_interaction_at,
                co.name as company_name
         FROM contacts c
         LEFT JOIN companies co ON c.company_id = co.id
         WHERE c.user_id = ? AND c.last_interaction_at < ? AND c.segment IN ('hot_lead', 'warm')
         ORDER BY c.relationship_score DESC
         LIMIT 10`
      )
      .bind(userId, thirtyDaysAgo)
      .all();

    const stalledContacts = stalledResult.results ?? [];

    // 2. Search network for warm paths
    const warmPathResult = await db
      .prepare(
        `SELECT c.id, c.full_name, c.email, c.title, c.outreach_path,
                co.name as company_name
         FROM contacts c
         LEFT JOIN companies co ON c.company_id = co.id
         WHERE c.user_id = ? AND c.outreach_path IN ('warm_intro', 'second_degree') AND c.segment = 'connected'
         ORDER BY c.relationship_score DESC
         LIMIT 10`
      )
      .bind(userId)
      .all();

    const warmPathContacts = warmPathResult.results ?? [];

    // 3. Discover net-new prospects via Apollo
    const icpLog = await db
      .prepare(
        `SELECT input FROM agent_logs WHERE user_id = ? AND action = 'icp_saved' ORDER BY created_at DESC LIMIT 1`
      )
      .bind(userId)
      .first();

    let netNewProspects: unknown[] = [];

    if (icpLog?.input) {
      const icp = typeof icpLog.input === 'string'
        ? JSON.parse(icpLog.input as string)
        : icpLog.input as Record<string, unknown>;
      try {
        const apolloResults = await searchPeople(c.env.APOLLO_API_KEY, {
          q_person_title: (icp.target_titles as string[])?.join(' OR '),
          person_locations: icp.target_locations as string[] | undefined,
          person_seniorities: ['director', 'vp', 'c_suite'],
          per_page: Math.min(maxResults, 25),
        });

        netNewProspects = apolloResults.people.map((p) => ({
          name: p.name,
          title: p.title,
          email: p.email,
          linkedin_url: p.linkedin_url,
          company: p.organization_name,
          location: [p.city, p.state].filter(Boolean).join(', '),
        }));
      } catch (apolloError) {
        console.error('[onboarding/discover] Apollo search failed:', apolloError);
      }
    }

    // Use AI to generate a summary
    const discoveryData = {
      stalled_deals: stalledContacts,
      warm_paths: warmPathContacts,
      net_new: netNewProspects,
    };

    const response = await aiGateway({
      model: 'haiku',
      userId,
      agentType: 'scout',
      db,
      apiKey: c.env.ANTHROPIC_API_KEY,
      messages: [
        {
          role: 'user',
          content: `Analyze these discovery results and provide a brief summary with recommendations.

Data: ${JSON.stringify(discoveryData, null, 2)}

Respond with JSON: {
  "summary": "1-2 sentence overview",
  "top_recommendations": ["rec 1", "rec 2", "rec 3"],
  "stalled_count": number,
  "warm_path_count": number,
  "new_prospect_count": number
}`,
        },
      ],
    });

    let summary: Record<string, unknown>;
    try {
      summary = JSON.parse(response.content);
    } catch {
      summary = { summary: response.content };
    }

    return c.json({
      summary,
      stalled_deals: stalledContacts,
      warm_paths: warmPathContacts,
      net_new_prospects: netNewProspects,
    });
  } catch (error) {
    console.error('[onboarding/discover] Discovery failed:', error);
    return c.json({ error: 'Discovery failed' }, 500);
  }
});

export default onboarding;
