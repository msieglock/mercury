import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../middleware/auth.js';
import { getUserId } from '../middleware/auth.js';
import { getServiceClient } from '../lib/supabase.js';
import { enrichPerson, enrichOrganization, searchPeople } from '../lib/apollo.js';

const contacts = new Hono<AuthEnv>();

// ─── Schemas ────────────────────────────────────────────────────────────────

const listContactsSchema = z.object({
  segment: z
    .enum(['hot_lead', 'warm', 'cold', 'candidate', 'customer', 'connected', 'needs_followup'])
    .optional(),
  outreachPath: z
    .enum([
      'direct_inbox',
      'direct_text',
      'direct_linkedin',
      'warm_intro',
      'second_degree',
      'cold_enriched',
      'cold_research',
    ])
    .optional(),
  search: z.string().optional(),
  sort: z.enum(['name', 'score', 'last_interaction', 'created']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const searchContactsSchema = z.object({
  title: z.string().optional(),
  company: z.string().optional(),
  domains: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  seniorities: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

// ─── GET /contacts ──────────────────────────────────────────────────────────

contacts.get('/', async (c) => {
  const userId = getUserId(c);
  const queryParams = c.req.query();

  const parsed = listContactsSchema.safeParse(queryParams);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { segment, outreachPath, search, sort, limit = 50, offset = 0 } = parsed.data;

  try {
    const supabase = getServiceClient();

    let query = supabase
      .from('contacts')
      .select('*, companies(id, name, domain, logo_url)', { count: 'exact' })
      .eq('user_id', userId);

    // Apply filters
    if (segment) {
      query = query.eq('segment', segment);
    }

    if (outreachPath) {
      query = query.eq('outreach_path', outreachPath);
    }

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,title.ilike.%${search}%`
      );
    }

    // Apply sorting
    switch (sort) {
      case 'name':
        query = query.order('full_name', { ascending: true });
        break;
      case 'score':
        query = query.order('relationship_score', { ascending: false });
        break;
      case 'last_interaction':
        query = query.order('last_interaction_at', { ascending: false, nullsFirst: false });
        break;
      case 'created':
        query = query.order('created_at', { ascending: false });
        break;
      default:
        query = query.order('relationship_score', { ascending: false });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      return c.json({ error: 'Failed to fetch contacts' }, 500);
    }

    return c.json({
      contacts: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[contacts] Failed to fetch contacts:', error);
    return c.json({ error: 'Failed to fetch contacts' }, 500);
  }
});

// ─── GET /contacts/:id ──────────────────────────────────────────────────────

contacts.get('/:id', async (c) => {
  const userId = getUserId(c);
  const contactId = c.req.param('id');

  try {
    const supabase = getServiceClient();

    // Fetch contact with company
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*, companies(*)')
      .eq('id', contactId)
      .eq('user_id', userId)
      .single();

    if (contactError || !contact) {
      return c.json({ error: 'Contact not found' }, 404);
    }

    // Fetch recent interactions
    const { data: interactions } = await supabase
      .from('interactions')
      .select('*')
      .eq('contact_id', contactId)
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(20);

    // Fetch pending actions for this contact
    const { data: pendingActions } = await supabase
      .from('actions')
      .select('*')
      .eq('contact_id', contactId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .limit(5);

    // Fetch pipeline items for this contact
    const { data: pipelineItems } = await supabase
      .from('pipeline_items')
      .select('*, pipelines(id, name, type)')
      .eq('contact_id', contactId);

    return c.json({
      contact,
      interactions: interactions ?? [],
      pending_actions: pendingActions ?? [],
      pipeline_items: pipelineItems ?? [],
    });
  } catch (error) {
    console.error('[contacts] Failed to fetch contact detail:', error);
    return c.json({ error: 'Failed to fetch contact detail' }, 500);
  }
});

// ─── POST /contacts/search ──────────────────────────────────────────────────

contacts.post('/search', async (c) => {
  const userId = getUserId(c);
  const body = await c.req.json();
  const parsed = searchContactsSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { title, company, domains, locations, seniorities, limit = 25 } = parsed.data;

  try {
    const results = await searchPeople({
      q_person_title: title,
      q_organization_name: company,
      q_organization_domains: domains,
      person_locations: locations,
      person_seniorities: seniorities,
      per_page: limit,
    });

    // Transform Apollo results for the client
    const prospects = results.people.map((person) => ({
      name: person.name,
      first_name: person.first_name,
      last_name: person.last_name,
      title: person.title,
      email: person.email,
      linkedin_url: person.linkedin_url,
      organization_name: person.organization_name,
      organization: person.organization
        ? {
            name: person.organization.name,
            website: person.organization.website_url,
            industry: person.organization.industry,
            size: person.organization.estimated_num_employees,
          }
        : null,
      location: [person.city, person.state, person.country].filter(Boolean).join(', '),
      photo_url: person.photo_url,
    }));

    return c.json({
      prospects,
      total: results.pagination.total_entries,
      page: results.pagination.page,
      total_pages: results.pagination.total_pages,
    });
  } catch (error) {
    console.error('[contacts/search] Apollo search failed:', error);
    return c.json({ error: 'Contact search failed' }, 500);
  }
});

// ─── POST /contacts/:id/enrich ──────────────────────────────────────────────

contacts.post('/:id/enrich', async (c) => {
  const userId = getUserId(c);
  const contactId = c.req.param('id');

  try {
    const supabase = getServiceClient();

    // Fetch the contact
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .eq('user_id', userId)
      .single();

    if (contactError || !contact) {
      return c.json({ error: 'Contact not found' }, 404);
    }

    // Enrich via Apollo
    const enriched = await enrichPerson({
      email: contact.email ?? undefined,
      first_name: contact.first_name ?? undefined,
      last_name: contact.last_name ?? undefined,
      linkedin_url: contact.linkedin_url ?? undefined,
    });

    if (!enriched) {
      return c.json({ error: 'No enrichment data found for this contact' }, 404);
    }

    // Update the contact with enriched data
    const updates: Record<string, unknown> = {
      title: enriched.title || contact.title,
      linkedin_url: enriched.linkedin_url || contact.linkedin_url,
      avatar_url: enriched.photo_url || contact.avatar_url,
      enrichment_data: enriched as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    };

    // Handle company enrichment
    if (enriched.organization) {
      const org = enriched.organization;

      // Try to find or create the company
      let companyId = contact.company_id;

      if (!companyId && org.website_url) {
        const { data: existingCompany } = await supabase
          .from('companies')
          .select('id')
          .eq('user_id', userId)
          .eq('domain', org.website_url)
          .maybeSingle();

        if (existingCompany) {
          companyId = existingCompany.id;
        } else {
          const { data: newCompany } = await supabase
            .from('companies')
            .insert({
              user_id: userId,
              name: org.name,
              domain: org.website_url,
              industry: org.industry,
              size: org.estimated_num_employees?.toString() ?? null,
              logo_url: org.logo_url,
              linkedin_url: org.linkedin_url,
              description: org.short_description,
              enrichment_data: org as unknown as Record<string, unknown>,
            })
            .select('id')
            .single();

          companyId = newCompany?.id ?? null;
        }
      }

      if (companyId) {
        updates.company_id = companyId;
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', contactId)
      .select('*, companies(*)')
      .single();

    if (updateError) {
      return c.json({ error: 'Failed to update contact with enrichment data' }, 500);
    }

    return c.json({
      contact: updated,
      enrichment: enriched,
    });
  } catch (error) {
    console.error('[contacts/enrich] Enrichment failed:', error);
    return c.json({ error: 'Contact enrichment failed' }, 500);
  }
});

export default contacts;
