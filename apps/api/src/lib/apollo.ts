// ─── Types ──────────────────────────────────────────────────────────────────

interface ApolloSearchPeopleParams {
  q_person_title?: string;
  q_organization_name?: string;
  q_organization_domains?: string[];
  person_locations?: string[];
  person_seniorities?: string[];
  per_page?: number;
  page?: number;
}

interface ApolloEnrichPersonParams {
  email?: string;
  first_name?: string;
  last_name?: string;
  organization_name?: string;
  domain?: string;
  linkedin_url?: string;
}

interface ApolloSearchOrgsParams {
  q_organization_name?: string;
  organization_locations?: string[];
  organization_num_employees_ranges?: string[];
  per_page?: number;
  page?: number;
}

interface ApolloEnrichOrgParams {
  domain: string;
}

export interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  title: string;
  email: string | null;
  linkedin_url: string | null;
  organization_name: string | null;
  organization: ApolloOrganization | null;
  city: string | null;
  state: string | null;
  country: string | null;
  photo_url: string | null;
  seniority: string | null;
  departments: string[];
}

export interface ApolloOrganization {
  id: string;
  name: string;
  website_url: string | null;
  linkedin_url: string | null;
  industry: string | null;
  estimated_num_employees: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  logo_url: string | null;
  short_description: string | null;
  annual_revenue: number | null;
  technologies: string[];
}

interface ApolloSearchPeopleResponse {
  people: ApolloPerson[];
  pagination: { total_entries: number; per_page: number; page: number; total_pages: number };
}

interface ApolloSearchOrgsResponse {
  organizations: ApolloOrganization[];
  pagination: { total_entries: number; per_page: number; page: number; total_pages: number };
}

// ─── Rate limiter ───────────────────────────────────────────────────────────

class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per ms
  private lastRefill: number;

  constructor(maxPerSecond: number) {
    this.maxTokens = maxPerSecond;
    this.tokens = maxPerSecond;
    this.refillRate = maxPerSecond / 1000;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens < 1) {
      const waitMs = (1 - this.tokens) / this.refillRate;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      this.refill();
    }

    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

// Apollo API rate limit: ~5 requests per second
const rateLimiter = new RateLimiter(5);

// ─── API Client ─────────────────────────────────────────────────────────────

const APOLLO_BASE_URL = 'https://api.apollo.io/v1';

async function apolloFetch<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error('Missing APOLLO_API_KEY environment variable');
  }

  await rateLimiter.acquire();

  const response = await fetch(`${APOLLO_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    // Rate limited -- wait and retry once
    const retryAfter = parseInt(response.headers.get('retry-after') ?? '5', 10);
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return apolloFetch<T>(endpoint, body);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    throw new Error(`Apollo API error (${response.status}): ${errorBody}`);
  }

  return response.json() as Promise<T>;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Search for people matching given criteria via Apollo People Search.
 */
export async function searchPeople(
  params: ApolloSearchPeopleParams
): Promise<ApolloSearchPeopleResponse> {
  return apolloFetch<ApolloSearchPeopleResponse>('/mixed_people/search', {
    ...params,
    per_page: params.per_page ?? 25,
    page: params.page ?? 1,
  });
}

/**
 * Enrich a single person with Apollo People Enrichment.
 */
export async function enrichPerson(
  params: ApolloEnrichPersonParams
): Promise<ApolloPerson | null> {
  const result = await apolloFetch<{ person: ApolloPerson | null }>('/people/match', params as unknown as Record<string, unknown>);
  return result.person;
}

/**
 * Search for organizations matching given criteria.
 */
export async function searchOrganizations(
  params: ApolloSearchOrgsParams
): Promise<ApolloSearchOrgsResponse> {
  return apolloFetch<ApolloSearchOrgsResponse>('/mixed_organizations/search', {
    ...params,
    per_page: params.per_page ?? 25,
    page: params.page ?? 1,
  });
}

/**
 * Enrich a single organization by domain.
 */
export async function enrichOrganization(
  params: ApolloEnrichOrgParams
): Promise<ApolloOrganization | null> {
  const result = await apolloFetch<{ organization: ApolloOrganization | null }>(
    '/organizations/enrich',
    params as unknown as Record<string, unknown>
  );
  return result.organization;
}
