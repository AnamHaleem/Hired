import { env } from "@/lib/config";
import { type JobSearchListing } from "@/lib/job-search/types";

export type AdzunaJobListing = JobSearchListing;

type AdzunaApiResponse = {
  results?: Array<{
    id?: string | number;
    title?: string;
    description?: string;
    redirect_url?: string;
    created?: string;
    salary_min?: number;
    salary_max?: number;
    contract_type?: string;
    contract_time?: string;
    company?: {
      display_name?: string;
    };
    location?: {
      display_name?: string;
    };
    category?: {
      label?: string;
    };
  }>;
};

const CANADA_TOKENS = [
  "canada",
  "toronto",
  "ontario",
  "vancouver",
  "alberta",
  "quebec",
  "montreal",
  "calgary",
  "ottawa",
];
const UNITED_STATES_TOKENS = [
  "united states",
  "usa",
  "new york",
  "california",
  "texas",
  "illinois",
  "florida",
  "washington",
  "massachusetts",
];
const UNITED_KINGDOM_TOKENS = [
  "united kingdom",
  "uk",
  "england",
  "scotland",
  "london",
  "manchester",
  "birmingham",
  "glasgow",
];
const AUSTRALIA_TOKENS = [
  "australia",
  "sydney",
  "melbourne",
  "brisbane",
  "perth",
];

function normalizeCountryCode(value: string) {
  return value.trim().toLowerCase();
}

function includesAnyToken(value: string, tokens: string[]) {
  return tokens.some((token) => value.includes(token));
}

export function detectAdzunaCountry(location: string) {
  const normalized = location.toLowerCase();

  if (includesAnyToken(normalized, CANADA_TOKENS)) {
    return "ca";
  }

  if (includesAnyToken(normalized, UNITED_STATES_TOKENS)) {
    return "us";
  }

  if (includesAnyToken(normalized, UNITED_KINGDOM_TOKENS)) {
    return "gb";
  }

  if (includesAnyToken(normalized, AUSTRALIA_TOKENS)) {
    return "au";
  }

  return normalizeCountryCode(env.ADZUNA_COUNTRY);
}

export async function searchAdzunaJobs(args: {
  location: string;
  query: string;
  country?: string;
  resultsPerPage?: number;
}) {
  if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) {
    throw new Error(
      "Adzuna is not configured yet. Add ADZUNA_APP_ID and ADZUNA_APP_KEY to enable location sweeps.",
    );
  }

  const country = normalizeCountryCode(args.country ?? detectAdzunaCountry(args.location));
  const resultsPerPage = args.resultsPerPage ?? 8;
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);

  url.searchParams.set("app_id", env.ADZUNA_APP_ID);
  url.searchParams.set("app_key", env.ADZUNA_APP_KEY);
  url.searchParams.set("results_per_page", String(resultsPerPage));
  url.searchParams.set("what", args.query);
  url.searchParams.set("where", args.location);
  url.searchParams.set("sort_by", "date");
  url.searchParams.set("max_days_old", "21");
  url.searchParams.set("content-type", "application/json");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    next: {
      revalidate: 0,
    },
  });

  if (!response.ok) {
    throw new Error(`Adzuna search failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as AdzunaApiResponse;

  return (payload.results ?? [])
    .flatMap((job) => {
      if (!job.title || !job.redirect_url) {
        return [];
      }

      return [
        {
          id: `adzuna:${job.id ?? job.redirect_url}`,
          provider: "adzuna",
          sourceLabel: "Adzuna",
          title: job.title,
          company: job.company?.display_name?.trim() || "Company not detected",
          location: job.location?.display_name?.trim() || args.location,
          description: job.description?.trim() || "",
          redirectUrl: job.redirect_url,
          salaryMin: typeof job.salary_min === "number" ? job.salary_min : null,
          salaryMax: typeof job.salary_max === "number" ? job.salary_max : null,
          createdAt: typeof job.created === "string" ? job.created : null,
          category: job.category?.label?.trim() || null,
          contractType: job.contract_type?.trim() || null,
          contractTime: job.contract_time?.trim() || null,
        } satisfies AdzunaJobListing,
      ];
    })
    .filter((job) => job.description.length > 0);
}
