// Mercury Contact Enrichment – Supabase Edge Function
// Calls Apollo People Enrichment API to fill in contact details,
// and triggers company enrichment if a new domain is discovered.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const APOLLO_PEOPLE_ENRICH_URL =
  "https://api.apollo.io/v1/people/match";
const APOLLO_ORG_ENRICH_URL =
  "https://api.apollo.io/v1/organizations/enrich";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EnrichRequest {
  contact_id: string;
  user_id: string;
}

interface ApolloPersonResult {
  id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  headline?: string;
  email?: string;
  phone_numbers?: Array<{ raw_number: string; type: string }>;
  linkedin_url?: string;
  photo_url?: string;
  organization?: {
    id?: string;
    name?: string;
    website_url?: string;
    industry?: string;
    estimated_num_employees?: number;
    linkedin_url?: string;
    logo_url?: string;
    primary_domain?: string;
  };
  city?: string;
  state?: string;
  country?: string;
  departments?: string[];
  seniority?: string;
}

interface ApolloOrgResult {
  id?: string;
  name?: string;
  website_url?: string;
  industry?: string;
  estimated_num_employees?: number;
  linkedin_url?: string;
  logo_url?: string;
  primary_domain?: string;
  short_description?: string;
  annual_revenue?: number;
  founded_year?: number;
  keywords?: string[];
}

function employeeCountToSize(count?: number): string {
  if (!count) return "Unknown";
  if (count <= 10) return "1-10";
  if (count <= 50) return "11-50";
  if (count <= 200) return "51-200";
  if (count <= 500) return "201-500";
  if (count <= 1000) return "501-1000";
  if (count <= 5000) return "1001-5000";
  return "5001+";
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apolloApiKey = Deno.env.get("APOLLO_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { contact_id, user_id }: EnrichRequest = await req.json();

    if (!contact_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "contact_id and user_id are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch the contact
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contact_id)
      .eq("user_id", user_id)
      .single();

    if (contactError || !contact) {
      return new Response(
        JSON.stringify({ error: "Contact not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build Apollo People Match request
    const apolloParams: Record<string, string> = {};
    if (contact.email) apolloParams.email = contact.email;
    if (contact.first_name) apolloParams.first_name = contact.first_name;
    if (contact.last_name) apolloParams.last_name = contact.last_name;
    if (contact.linkedin_url) apolloParams.linkedin_url = contact.linkedin_url;

    // Need at least email or LinkedIn to enrich
    if (!apolloParams.email && !apolloParams.linkedin_url) {
      return new Response(
        JSON.stringify({
          error: "Contact must have email or LinkedIn URL for enrichment",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Call Apollo People Enrichment
    const apolloResponse = await fetch(APOLLO_PEOPLE_ENRICH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apolloApiKey,
      },
      body: JSON.stringify(apolloParams),
    });

    const apolloData = await apolloResponse.json();
    const person: ApolloPersonResult | null = apolloData.person ?? null;

    if (!person) {
      // Log the miss
      await supabase.from("agent_logs").insert({
        user_id,
        action: "enrich_contact",
        model: "apollo",
        input_tokens: 0,
        output_tokens: 0,
        request_body: { contact_id, params: apolloParams },
        response_body: { match: false },
      });

      return new Response(
        JSON.stringify({ enriched: false, message: "No match found in Apollo" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build contact update payload
    const contactUpdate: Record<string, unknown> = {
      enrichment_data: {
        ...((contact.enrichment_data as Record<string, unknown>) || {}),
        apollo_id: person.id,
        headline: person.headline,
        city: person.city,
        state: person.state,
        country: person.country,
        departments: person.departments,
        seniority: person.seniority,
        enriched_at: new Date().toISOString(),
      },
    };

    // Fill in missing fields only
    if (!contact.first_name && person.first_name) {
      contactUpdate.first_name = person.first_name;
    }
    if (!contact.last_name && person.last_name) {
      contactUpdate.last_name = person.last_name;
    }
    if (!contact.title && person.title) {
      contactUpdate.title = person.title;
    }
    if (!contact.email && person.email) {
      contactUpdate.email = person.email;
    }
    if (!contact.phone && person.phone_numbers?.length) {
      contactUpdate.phone = person.phone_numbers[0].raw_number;
    }
    if (!contact.linkedin_url && person.linkedin_url) {
      contactUpdate.linkedin_url = person.linkedin_url;
    }
    if (!contact.avatar_url && person.photo_url) {
      contactUpdate.avatar_url = person.photo_url;
    }

    // Update contact record
    await supabase
      .from("contacts")
      .update(contactUpdate)
      .eq("id", contact_id);

    // Company enrichment: if Apollo returned an organization and contact
    // doesn't have a company_id, or the company domain is new
    let companyEnriched = false;
    let companyId = contact.company_id;

    if (person.organization?.primary_domain) {
      const orgDomain = person.organization.primary_domain;

      // Check if we already have this company for this user
      const { data: existingCompany } = await supabase
        .from("companies")
        .select("id, domain")
        .eq("user_id", user_id)
        .eq("domain", orgDomain)
        .single();

      if (existingCompany) {
        // Link contact to existing company if not already linked
        if (!contact.company_id) {
          await supabase
            .from("contacts")
            .update({ company_id: existingCompany.id })
            .eq("id", contact_id);
          companyId = existingCompany.id;
        }
      } else {
        // Enrich company via Apollo Organizations API
        const orgResponse = await fetch(
          `${APOLLO_ORG_ENRICH_URL}?domain=${encodeURIComponent(orgDomain)}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apolloApiKey,
            },
          }
        );

        const orgData = await orgResponse.json();
        const org: ApolloOrgResult | null = orgData.organization ?? null;

        // Create company record
        const companyPayload = {
          user_id,
          name: org?.name ?? person.organization.name ?? orgDomain,
          domain: orgDomain,
          industry: org?.industry ?? person.organization.industry ?? null,
          size: employeeCountToSize(
            org?.estimated_num_employees ??
              person.organization.estimated_num_employees
          ),
          linkedin_url:
            org?.linkedin_url ?? person.organization.linkedin_url ?? null,
          logo_url: org?.logo_url ?? person.organization.logo_url ?? null,
          enrichment_data: {
            apollo_org_id: org?.id ?? person.organization.id,
            short_description: org?.short_description,
            annual_revenue: org?.annual_revenue,
            founded_year: org?.founded_year,
            keywords: org?.keywords,
            enriched_at: new Date().toISOString(),
          },
        };

        const { data: newCompany } = await supabase
          .from("companies")
          .insert(companyPayload)
          .select("id")
          .single();

        if (newCompany) {
          companyId = newCompany.id;
          // Link the contact to the new company
          await supabase
            .from("contacts")
            .update({ company_id: newCompany.id })
            .eq("id", contact_id);
          companyEnriched = true;
        }
      }
    }

    // Log the enrichment
    await supabase.from("agent_logs").insert({
      user_id,
      action: "enrich_contact",
      model: "apollo",
      input_tokens: 0,
      output_tokens: 0,
      request_body: { contact_id, params: apolloParams },
      response_body: {
        match: true,
        fields_updated: Object.keys(contactUpdate),
        company_enriched: companyEnriched,
        company_id: companyId,
      },
    });

    return new Response(
      JSON.stringify({
        enriched: true,
        contact_id,
        company_id: companyId,
        company_enriched: companyEnriched,
        fields_updated: Object.keys(contactUpdate),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Enrich contact error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", message: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
