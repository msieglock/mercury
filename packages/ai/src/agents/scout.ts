import type { Contact, Company } from '@mercury/shared';
import { aiGateway } from '../gateway';

export interface ProspectResearchResult {
  summary: string;
  keyFacts: string[];
  commonConnections: string[];
  suggestedApproach: string;
  orgChart: OrgChartEntry[] | null;
  similarContacts: SimilarContact[];
}

export interface OrgChartEntry {
  name: string;
  title: string;
  relationship: 'reports_to' | 'peer' | 'direct_report' | 'unknown';
}

export interface SimilarContact {
  name: string;
  title: string;
  company: string;
  similarityReason: string;
  score: number;
}

/**
 * ScoutAgent researches prospects, finds similar contacts,
 * and maps organizational charts to enable smarter outreach.
 */
export class ScoutAgent {
  /**
   * Research a prospect using available data sources.
   * Combines enrichment data with AI analysis.
   */
  async researchProspect(
    contact: Contact,
    company: Company | null,
    enrichmentData?: Record<string, unknown>,
  ): Promise<ProspectResearchResult> {
    const contextParts: string[] = [
      `Name: ${contact.full_name}`,
      contact.title ? `Title: ${contact.title}` : '',
      contact.email ? `Email: ${contact.email}` : '',
      contact.linkedin_url ? `LinkedIn: ${contact.linkedin_url}` : '',
      company ? `Company: ${company.name}` : '',
      company?.industry ? `Industry: ${company.industry}` : '',
      company?.size ? `Company size: ${company.size}` : '',
      company?.description ? `Company description: ${company.description}` : '',
    ].filter(Boolean);

    if (enrichmentData) {
      contextParts.push(`Enrichment data: ${JSON.stringify(enrichmentData)}`);
    }

    const response = await aiGateway({
      messages: [
        {
          role: 'user',
          content: `Research this prospect and provide actionable intelligence for outreach.\n\n${contextParts.join('\n')}\n\nReturn JSON with: summary (string), keyFacts (string[]), commonConnections (string[]), suggestedApproach (string), orgChart (array of {name, title, relationship} or null), similarContacts (empty array for now).`,
        },
      ],
      system:
        'You are a sales intelligence analyst. Research the given prospect and provide structured insights. Return ONLY valid JSON.',
      tier: 'fast',
      maxTokens: 2048,
      temperature: 0.4,
      agentType: 'scout',
      action: 'research_prospect',
    });

    try {
      return JSON.parse(response.content) as ProspectResearchResult;
    } catch {
      return {
        summary: response.content,
        keyFacts: [],
        commonConnections: [],
        suggestedApproach: 'Unable to parse structured research. Review raw analysis.',
        orgChart: null,
        similarContacts: [],
      };
    }
  }

  /**
   * Find contacts similar to a given contact based on title, industry, and company profile.
   */
  async findSimilarContacts(
    contact: Contact,
    allContacts: Contact[],
    companies: Map<string, Company>,
  ): Promise<SimilarContact[]> {
    const contactCompany = contact.company_id
      ? companies.get(contact.company_id)
      : null;

    const candidateDescriptions = allContacts
      .filter((c) => c.id !== contact.id)
      .slice(0, 50)
      .map((c) => {
        const comp = c.company_id ? companies.get(c.company_id) : null;
        return `- ${c.full_name} | ${c.title ?? 'N/A'} | ${comp?.name ?? 'N/A'} | ${comp?.industry ?? 'N/A'}`;
      })
      .join('\n');

    const response = await aiGateway({
      messages: [
        {
          role: 'user',
          content: `Find contacts most similar to this person:

Target: ${contact.full_name} | ${contact.title ?? 'N/A'} | ${contactCompany?.name ?? 'N/A'} | ${contactCompany?.industry ?? 'N/A'}

Candidates:
${candidateDescriptions}

Return a JSON array of the top 5 most similar contacts:
[{ "name": "...", "title": "...", "company": "...", "similarityReason": "...", "score": 0.0-1.0 }]`,
        },
      ],
      system:
        'You are a sales intelligence analyst. Find the most similar contacts based on role, seniority, industry, and company profile. Return ONLY a valid JSON array.',
      tier: 'fast',
      maxTokens: 1024,
      temperature: 0.3,
      agentType: 'scout',
      action: 'find_similar',
    });

    try {
      return JSON.parse(response.content) as SimilarContact[];
    } catch {
      return [];
    }
  }

  /**
   * Map the organizational chart around a contact.
   */
  async mapOrgChart(
    contact: Contact,
    company: Company | null,
    knownContacts: Contact[],
  ): Promise<OrgChartEntry[]> {
    const knownPeople = knownContacts
      .filter((c) => c.company_id === contact.company_id && c.id !== contact.id)
      .map((c) => `- ${c.full_name} | ${c.title ?? 'Unknown title'}`)
      .join('\n');

    const response = await aiGateway({
      messages: [
        {
          role: 'user',
          content: `Map the organizational relationships for:

Target: ${contact.full_name} | ${contact.title ?? 'Unknown title'}
Company: ${company?.name ?? 'Unknown'} (${company?.size ?? 'unknown size'})

Known contacts at this company:
${knownPeople || 'None'}

Based on titles and typical org structures, infer relationships.
Return a JSON array: [{ "name": "...", "title": "...", "relationship": "reports_to" | "peer" | "direct_report" | "unknown" }]`,
        },
      ],
      system:
        'You are an organizational analyst. Infer reporting relationships from job titles. Return ONLY a valid JSON array.',
      tier: 'fast',
      maxTokens: 1024,
      temperature: 0.3,
      agentType: 'scout',
      action: 'map_org_chart',
    });

    try {
      return JSON.parse(response.content) as OrgChartEntry[];
    } catch {
      return [];
    }
  }
}
