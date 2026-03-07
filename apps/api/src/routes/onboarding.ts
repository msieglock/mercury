import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../middleware/auth.js';
import { getUserId } from '../middleware/auth.js';
import { getServiceClient } from '../lib/supabase.js';
import { addEmailSyncJob, addEnrichmentJob } from '../jobs/index.js';
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
    const supabase = getServiceClient();

    // Verify user exists and hasn't already completed onboarding
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, onboarding_completed')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Check for linked Google account
    const { data: linkedAccount } = await supabase
      .from('linked_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .eq('is_active', true)
      .maybeSingle();

    const jobs: Record<string, string> = {};

    // Enqueue email pull (if Google is linked)
    if (linkedAccount) {
      const emailJobId = await addEmailSyncJob({ userId, fullHistory: true });
      jobs.email_sync = emailJobId;
    }

    // Enqueue contact enrichment (will run after email sync populates contacts)
    const enrichJobId = await addEnrichmentJob({ userId, source: 'onboarding' });
    jobs.enrichment = enrichJobId;

    // Store onboarding job IDs in user metadata
    await supabase
      .from('users')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    // Store job tracking data
    await supabase.from('agent_logs').insert({
      user_id: userId,
      agent_type: 'orchestrator',
      action: 'onboarding_started',
      input: { jobs },
      output: null,
      tokens_used: 0,
      model: 'system',
      cost_cents: 0,
      duration_ms: 0,
      error: null,
    });

    return c.json({
      success: true,
      jobs,
      message: 'Onboarding jobs enqueued. Poll /onboarding/status for progress.',
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
    const supabase = getServiceClient();

    // Check various onboarding progress indicators
    const [contactsResult, interactionsResult, linkedAccountResult, userResult] =
      await Promise.all([
        supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        supabase
          .from('interactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        supabase
          .from('linked_accounts')
          .select('provider, is_active')
          .eq('user_id', userId),
        supabase
          .from('users')
          .select('style_fingerprint, onboarding_completed, mode')
          .eq('id', userId)
          .single(),
      ]);

    const contactCount = contactsResult.count ?? 0;
    const interactionCount = interactionsResult.count ?? 0;
    const linkedAccounts = linkedAccountResult.data ?? [];
    const user = userResult.data;

    const steps = {
      google_connected: linkedAccounts.some((a) => a.provider === 'google' && a.is_active),
      email_synced: interactionCount > 0,
      contacts_imported: contactCount > 0,
      contacts_enriched: contactCount > 5, // rough proxy
      style_analyzed: !!user?.style_fingerprint,
      icp_set: !!user?.mode, // rough proxy
      onboarding_completed: user?.onboarding_completed ?? false,
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
    const supabase = getServiceClient();

    // Store ICP preferences -- we use agent_logs to track this
    await supabase.from('agent_logs').insert({
      user_id: userId,
      agent_type: 'orchestrator',
      action: 'icp_saved',
      input: parsed.data,
      output: null,
      tokens_used: 0,
      model: 'system',
      cost_cents: 0,
      duration_ms: 0,
      error: null,
    });

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
    const supabase = getServiceClient();

    // 1. Mine inbox for stalled deals -- contacts with old last_interaction_at
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: stalledContacts } = await supabase
      .from('contacts')
      .select('id, full_name, email, title, segment, last_interaction_at, companies(name)')
      .eq('user_id', userId)
      .lt('last_interaction_at', thirtyDaysAgo)
      .in('segment', ['hot_lead', 'warm'])
      .order('relationship_score', { ascending: false })
      .limit(10);

    // 2. Search network for warm paths -- contacts with mutual connections
    const { data: warmPathContacts } = await supabase
      .from('contacts')
      .select('id, full_name, email, title, outreach_path, companies(name)')
      .eq('user_id', userId)
      .in('outreach_path', ['warm_intro', 'second_degree'])
      .eq('segment', 'connected')
      .order('relationship_score', { ascending: false })
      .limit(10);

    // 3. Discover net-new prospects via Apollo
    // First, fetch the user's ICP from agent_logs
    const { data: icpLog } = await supabase
      .from('agent_logs')
      .select('input')
      .eq('user_id', userId)
      .eq('action', 'icp_saved')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let netNewProspects: unknown[] = [];

    if (icpLog?.input) {
      const icp = icpLog.input as Record<string, unknown>;
      try {
        const apolloResults = await searchPeople({
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
      stalled_deals: stalledContacts ?? [],
      warm_paths: warmPathContacts ?? [],
      net_new: netNewProspects,
    };

    const response = await aiGateway({
      model: 'haiku',
      userId,
      agentType: 'scout',
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
      stalled_deals: stalledContacts ?? [],
      warm_paths: warmPathContacts ?? [],
      net_new_prospects: netNewProspects,
    });
  } catch (error) {
    console.error('[onboarding/discover] Discovery failed:', error);
    return c.json({ error: 'Discovery failed' }, 500);
  }
});

export default onboarding;
