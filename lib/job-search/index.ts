import { runtimeFlags } from "@/lib/config";
import { detectAdzunaCountry, searchAdzunaJobs } from "@/lib/job-search/adzuna";
import { fetchGreenhouseBoardJobs } from "@/lib/job-search/greenhouse";
import { fetchLeverSiteJobs } from "@/lib/job-search/lever";
import { listPublicJobBoardSources } from "@/lib/job-search/public-board-registry";
import { type JobSearchListing, type PublicJobBoardSource } from "@/lib/job-search/types";

const SEARCH_STOPWORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "senior",
  "junior",
  "lead",
  "manager",
  "director",
]);

type SearchCandidate = {
  listing: JobSearchListing;
  query: string;
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\bcomms\b/g, "communications");
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !SEARCH_STOPWORDS.has(token));
}

function uniq<T>(items: T[]) {
  return Array.from(new Set(items));
}

function detectFamilies(value: string) {
  const normalized = normalizeText(value);
  const families = new Set<string>();

  if (/communications|public affairs|media relations|internal communications/.test(normalized)) {
    families.add("communications");
  }

  if (/marketing|growth|brand|campaign/.test(normalized)) {
    families.add("marketing");
  }

  if (/partnership|alliances|ecosystem/.test(normalized)) {
    families.add("partnerships");
  }

  return Array.from(families);
}

function matchesLocation(location: string, listingLocation: string) {
  const desired = normalizeText(location).trim();
  const actual = normalizeText(listingLocation).trim();

  if (!desired) {
    return true;
  }

  if (actual.includes(desired) || desired.includes(actual)) {
    return true;
  }

  const desiredTokens = tokenize(desired);
  const actualTokens = tokenize(actual);

  if (desiredTokens.length === 0) {
    return true;
  }

  const sharedTokens = desiredTokens.filter((token) => actualTokens.includes(token));
  return sharedTokens.length >= Math.max(1, Math.ceil(desiredTokens.length / 2));
}

function matchesQuery(query: string, listing: JobSearchListing) {
  const normalizedQuery = normalizeText(query);
  const title = normalizeText(listing.title);
  const description = normalizeText(listing.description);
  const queryTokens = tokenize(normalizedQuery);

  if (queryTokens.length === 0) {
    return true;
  }

  const titleHits = queryTokens.filter((token) => title.includes(token)).length;
  const descriptionHits = queryTokens.filter((token) => description.includes(token)).length;
  const queryFamilies = detectFamilies(query);
  const listingFamilies = detectFamilies(`${listing.title} ${listing.description}`);

  if (titleHits >= Math.max(1, Math.ceil(queryTokens.length / 2))) {
    return true;
  }

  if (titleHits >= 1 && descriptionHits >= 1) {
    return true;
  }

  return (
    queryFamilies.some((family) => listingFamilies.includes(family)) &&
    (titleHits >= 1 || descriptionHits >= 1)
  );
}

async function fetchPublicSourceListings(source: PublicJobBoardSource) {
  if (source.provider === "greenhouse") {
    return fetchGreenhouseBoardJobs(source);
  }

  return fetchLeverSiteJobs(source);
}

export async function searchInternetJobs(args: {
  location: string;
  queries: string[];
  resultsPerPage?: number;
}) {
  const candidates: SearchCandidate[] = [];
  const seen = new Set<string>();
  const publicSources = listPublicJobBoardSources();
  const publicSourceResults = await Promise.allSettled(
    publicSources.map((source) => fetchPublicSourceListings(source)),
  );
  const publicListings = publicSourceResults
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter((listing) => matchesLocation(args.location, listing.location));

  const country = detectAdzunaCountry(args.location);
  const adzunaResults = runtimeFlags.hasAdzuna
    ? await Promise.all(
        args.queries.map(async (query) => {
          try {
            const listings = await searchAdzunaJobs({
              location: args.location,
              query,
              country,
              resultsPerPage: args.resultsPerPage,
            });

            return { query, listings };
          } catch (error) {
            console.error("Adzuna search failed for query", query, error);
            return { query, listings: [] as JobSearchListing[] };
          }
        }),
      )
    : [];

  for (const result of adzunaResults) {
    for (const listing of result.listings) {
      const key = listing.redirectUrl;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      candidates.push({
        listing,
        query: result.query,
      });
    }
  }

  for (const query of args.queries) {
    const filteredPublicListings = publicListings.filter((listing) => matchesQuery(query, listing));

    for (const listing of filteredPublicListings) {
      const key = listing.redirectUrl;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      candidates.push({
        listing,
        query,
      });
    }
  }

  return candidates.sort((left, right) => {
    return (
      new Date(right.listing.createdAt ?? 0).getTime() -
      new Date(left.listing.createdAt ?? 0).getTime()
    );
  });
}

export function getMarketSourceSummary() {
  const publicSourceSummary = listPublicJobBoardSources();
  const providerLabels = uniq(publicSourceSummary.map((source) => source.provider));

  return {
    adzunaEnabled: runtimeFlags.hasAdzuna,
    publicSources: publicSourceSummary.length,
    providerLabels,
  };
}
