import axios from 'axios';
import { config } from '../config';

const apolloClient = axios.create({
  baseURL: config.apollo.baseUrl,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  },
  timeout: 30000,
});

export interface ApolloSearchFilters {
  personTitles?: string[];
  personLocations?: string[];
  organizationNumEmployeesRanges?: string[];
  organizationIndustryTagIds?: string[];
  page?: number;
  perPage?: number;
}

export interface ApolloPerson {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email?: string;
  linkedinUrl?: string;
  title?: string;
  organization?: {
    name?: string;
    websiteUrl?: string;
    industry?: string;
    estimatedNumEmployees?: number;
    country?: string;
    city?: string;
  };
  city?: string;
  country?: string;
}

export interface ApolloSearchResult {
  people: ApolloPerson[];
  total: number;
  page: number;
  perPage: number;
}

/**
 * Search for leads using Apollo.io People Search API
 */
export async function searchLeads(filters: ApolloSearchFilters): Promise<ApolloSearchResult> {
  const apiKey = config.apollo.apiKey;
  if (!apiKey) {
    throw new Error('Apollo API key not configured');
  }

  const payload: Record<string, unknown> = {
    api_key: apiKey,
    page: filters.page ?? 1,
    per_page: filters.perPage ?? 25,
  };

  if (filters.personTitles && filters.personTitles.length > 0) {
    payload.person_titles = filters.personTitles;
  }
  if (filters.personLocations && filters.personLocations.length > 0) {
    payload.person_locations = filters.personLocations;
  }
  if (
    filters.organizationNumEmployeesRanges &&
    filters.organizationNumEmployeesRanges.length > 0
  ) {
    payload.organization_num_employees_ranges = filters.organizationNumEmployeesRanges;
  }
  if (
    filters.organizationIndustryTagIds &&
    filters.organizationIndustryTagIds.length > 0
  ) {
    payload.organization_industry_tag_ids = filters.organizationIndustryTagIds;
  }

  const response = await apolloClient.post<{
    people: ApolloPerson[];
    pagination: { total_entries: number; page: number; per_page: number };
  }>('/v1/mixed_people/search', payload);

  return {
    people: response.data.people ?? [],
    total: response.data.pagination?.total_entries ?? 0,
    page: response.data.pagination?.page ?? 1,
    perPage: response.data.pagination?.per_page ?? 25,
  };
}

export interface ApolloEnrichedPerson {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  linkedinUrl?: string;
  title?: string;
  organization?: {
    name?: string;
    websiteUrl?: string;
    industry?: string;
    estimatedNumEmployees?: number;
    country?: string;
    city?: string;
  };
  city?: string;
  country?: string;
  emailStatus?: string;
}

/**
 * Enrich a lead by email using Apollo.io People Match API
 */
export async function enrichLead(email: string): Promise<ApolloEnrichedPerson | null> {
  const apiKey = config.apollo.apiKey;
  if (!apiKey) {
    throw new Error('Apollo API key not configured');
  }

  try {
    const response = await apolloClient.get<{
      person?: ApolloEnrichedPerson;
      match_status?: string;
    }>('/v1/people/match', {
      params: {
        api_key: apiKey,
        email,
        reveal_personal_emails: true,
      },
    });

    return response.data.person ?? null;
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Map an Apollo person to our Lead shape
 */
export function mapApolloPersonToLead(person: ApolloPerson): {
  firstName: string;
  lastName: string;
  email?: string;
  linkedinUrl?: string;
  title?: string;
  company?: string;
  companySize?: string;
  industry?: string;
  country?: string;
  city?: string;
  website?: string;
  apolloId: string;
  source: string;
} {
  const org = person.organization;
  let companySize: string | undefined;
  if (org?.estimatedNumEmployees) {
    const n = org.estimatedNumEmployees;
    if (n < 10) companySize = '1-9';
    else if (n < 50) companySize = '10-49';
    else if (n < 200) companySize = '50-199';
    else if (n < 500) companySize = '200-499';
    else if (n < 1000) companySize = '500-999';
    else companySize = '1000+';
  }

  return {
    firstName: person.firstName ?? '',
    lastName: person.lastName ?? '',
    email: person.email,
    linkedinUrl: person.linkedinUrl,
    title: person.title,
    company: org?.name,
    companySize,
    industry: org?.industry,
    country: person.country ?? org?.country,
    city: person.city ?? org?.city,
    website: org?.websiteUrl,
    apolloId: person.id,
    source: 'apollo',
  };
}
