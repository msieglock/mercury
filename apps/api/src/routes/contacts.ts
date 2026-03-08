import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../middleware/auth.js';
import { getUserId } from '../middleware/auth.js';
import { enrichPerson, searchPeople } from '../lib/apollo.js';

const contacts = new Hono<AuthEnv>();

// ─── Schemas ────────────────────────────────────────────────────────────────

const listContactsSchema = z.object({
  segment: z
    .enum(['inner_circle', 'active_deal', 'keep_warm', 'dormant'])
    .optional(),
  outreachPath: z
    .enum(['inbound', 'warm_intro', 'cold_outbound', 'event'])
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
    const db = c.env.DB;

    // Build query dynamically
    const whereClauses: string[] = ['c.user_id = ?'];
    const params: unknown[] = [userId];

    if (segment) {
      whereClauses.push('c.segment = ?');
      params.push(segment);
    }

    if (outreachPath) {
      whereClauses.push('c.outreach_path = ?');
      params.push(outreachPath);
    }

    if (search) {
      whereClauses.push('(c.full_name LIKE ? OR c.email LIKE ? OR c.title LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Determine sort order
    let orderBy: string;
    switch (sort) {
      case 'name':
        orderBy = 'c.full_name ASC';
        break;
      case 'score':
        orderBy = 'c.relationship_score DESC';
        break;
      case 'last_interaction':
        orderBy = 'c.last_interaction_at DESC';
        break;
      case 'created':
        orderBy = 'c.created_at DESC';
        break;
      default:
        orderBy = 'c.relationship_score DESC';
    }

    const whereSQL = whereClauses.join(' AND ');

    // Get total count
    const countResult = await db
      .prepare(`SELECT COUNT(*) as total FROM contacts c WHERE ${whereSQL}`)
      .bind(...params)
      .first<{ total: number }>();

    const total = countResult?.total ?? 0;

    // Fetch paginated results with company join
    const contactsResult = await db
      .prepare(
        `SELECT c.*, co.id as company_id_ref, co.name as company_name, co.domain as company_domain, co.logo_url as company_logo_url
         FROM contacts c
         LEFT JOIN companies co ON c.company_id = co.id
         WHERE ${whereSQL}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`
      )
      .bind(...params, limit, offset)
      .all();

    // Transform results to include nested company object
    const contactsData = (contactsResult.results ?? []).map((row) => {
      const { company_id_ref, company_name, company_domain, company_logo_url, ...contactFields } = row as Record<string, unknown>;
      return {
        ...contactFields,
        tags: typeof contactFields.tags === 'string' ? JSON.parse(contactFields.tags as string) : contactFields.tags,
        enrichment_data: typeof contactFields.enrichment_data === 'string' ? JSON.parse(contactFields.enrichment_data as string) : contactFields.enrichment_data,
        companies: company_id_ref
          ? { id: company_id_ref, name: company_name, domain: company_domain, logo_url: company_logo_url }
          : null,
      };
    });

    return c.json({
      contacts: contactsData,
      total,
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
    const db = c.env.DB;

    // Fetch contact
    const contact = await db
      .prepare('SELECT * FROM contacts WHERE id = ? AND user_id = ?')
      .bind(contactId, userId)
      .first();

    if (!contact) {
      return c.json({ error: 'Contact not found' }, 404);
    }

    // Fetch company if linked
    let company: Record<string, unknown> | null = null;
    if (contact.company_id) {
      company = await db
        .prepare('SELECT * FROM companies WHERE id = ?')
        .bind(contact.company_id as string)
        .first();
    }

    // Fetch recent interactions
    const interactionsResult = await db
      .prepare(
        'SELECT * FROM interactions WHERE contact_id = ? AND user_id = ? ORDER BY occurred_at DESC LIMIT 20'
      )
      .bind(contactId, userId)
      .all();

    // Fetch pending actions for this contact
    const pendingActionsResult = await db
      .prepare(
        `SELECT * FROM actions WHERE contact_id = ? AND user_id = ? AND status = 'pending'
         ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END
         LIMIT 5`
      )
      .bind(contactId, userId)
      .all();

    // Fetch pipeline items for this contact
    const pipelineItemsResult = await db
      .prepare(
        `SELECT pi.*, p.id as pipeline_id_ref, p.name as pipeline_name, p.type as pipeline_type
         FROM pipeline_items pi
         LEFT JOIN pipelines p ON pi.pipeline_id = p.id
         WHERE pi.contact_id = ?`
      )
      .bind(contactId)
      .all();

    // Parse JSON fields
    const contactData = {
      ...contact,
      tags: typeof contact.tags === 'string' ? JSON.parse(contact.tags as string) : contact.tags,
      enrichment_data: typeof contact.enrichment_data === 'string' ? JSON.parse(contact.enrichment_data as string) : contact.enrichment_data,
      companies: company,
    };

    return c.json({
      contact: contactData,
      interactions: interactionsResult.results ?? [],
      pending_actions: pendingActionsResult.results ?? [],
      pipeline_items: (pipelineItemsResult.results ?? []).map((pi) => {
        const { pipeline_id_ref, pipeline_name, pipeline_type, ...itemFields } = pi as Record<string, unknown>;
        return {
          ...itemFields,
          pipelines: pipeline_id_ref
            ? { id: pipeline_id_ref, name: pipeline_name, type: pipeline_type }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error('[contacts] Failed to fetch contact detail:', error);
    return c.json({ error: 'Failed to fetch contact detail' }, 500);
  }
});

// ─── POST /contacts/search ──────────────────────────────────────────────────

contacts.post('/search', async (c) => {
  const body = await c.req.json();
  const parsed = searchContactsSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { title, company, domains, locations, seniorities, limit = 25 } = parsed.data;

  try {
    const results = await searchPeople(c.env.APOLLO_API_KEY, {
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
    const db = c.env.DB;

    // Fetch the contact
    const contact = await db
      .prepare('SELECT * FROM contacts WHERE id = ? AND user_id = ?')
      .bind(contactId, userId)
      .first();

    if (!contact) {
      return c.json({ error: 'Contact not found' }, 404);
    }

    // Enrich via Apollo
    const enriched = await enrichPerson(c.env.APOLLO_API_KEY, {
      email: (contact.email as string) ?? undefined,
      first_name: (contact.first_name as string) ?? undefined,
      last_name: (contact.last_name as string) ?? undefined,
      linkedin_url: (contact.linkedin_url as string) ?? undefined,
    });

    if (!enriched) {
      return c.json({ error: 'No enrichment data found for this contact' }, 404);
    }

    // Update the contact with enriched data
    let companyId = contact.company_id as string | null;

    // Handle company enrichment
    if (enriched.organization) {
      const org = enriched.organization;

      if (!companyId && org.website_url) {
        const existingCompany = await db
          .prepare('SELECT id FROM companies WHERE user_id = ? AND domain = ?')
          .bind(userId, org.website_url)
          .first<{ id: string }>();

        if (existingCompany) {
          companyId = existingCompany.id;
        } else {
          companyId = crypto.randomUUID();
          await db
            .prepare(
              `INSERT INTO companies (id, user_id, name, domain, industry, size, logo_url, linkedin_url, enrichment_data, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              companyId,
              userId,
              org.name,
              org.website_url,
              org.industry,
              org.estimated_num_employees?.toString() ?? null,
              org.logo_url,
              org.linkedin_url,
              JSON.stringify(org),
              new Date().toISOString(),
              new Date().toISOString()
            )
            .run();
        }
      }
    }

    await db
      .prepare(
        `UPDATE contacts SET title = ?, linkedin_url = ?, avatar_url = ?, enrichment_data = ?, company_id = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(
        enriched.title || (contact.title as string),
        enriched.linkedin_url || (contact.linkedin_url as string),
        enriched.photo_url || (contact.avatar_url as string),
        JSON.stringify(enriched),
        companyId,
        new Date().toISOString(),
        contactId
      )
      .run();

    // Fetch updated contact
    const updated = await db
      .prepare('SELECT * FROM contacts WHERE id = ?')
      .bind(contactId)
      .first();

    // Fetch company
    let company: Record<string, unknown> | null = null;
    if (companyId) {
      company = await db
        .prepare('SELECT * FROM companies WHERE id = ?')
        .bind(companyId)
        .first();
    }

    return c.json({
      contact: { ...updated, companies: company },
      enrichment: enriched,
    });
  } catch (error) {
    console.error('[contacts/enrich] Enrichment failed:', error);
    return c.json({ error: 'Contact enrichment failed' }, 500);
  }
});

export default contacts;
