import { runtimeFlags } from "@/lib/config";
import { detectAdzunaCountry, searchAdzunaJobs } from "@/lib/job-search/adzuna";
import { fetchAshbyBoardJobs } from "@/lib/job-search/ashby";
import { fetchGreenhouseBoardJobs } from "@/lib/job-search/greenhouse";
import { fetchLeverSiteJobs } from "@/lib/job-search/lever";
import { listPublicJobBoardSources } from "@/lib/job-search/public-board-registry";
import { fetchSmartRecruitersCompanyJobs } from "@/lib/job-search/smartrecruiters";
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
const COMPANY_STOPWORDS = new Set([
  "co",
  "company",
  "corp",
  "corporation",
  "inc",
  "incorporated",
  "limited",
  "llc",
  "ltd",
  "technologies",
]);
const LOCATION_STOPWORDS = new Set([
  "area",
  "canada",
  "city",
  "greater",
  "hybrid",
  "office",
  "on",
  "onsite",
  "site",
  "the",
  "united",
  "states",
  "usa",
]);
const RECENT_LISTING_WINDOW_DAYS = 14;
const RECENT_LISTING_WINDOW_MS = RECENT_LISTING_WINDOW_DAYS * 24 * 60 * 60 * 1000;

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

function normalizeCompanyName(value: string) {
  return normalizeText(value)
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !COMPANY_STOPWORDS.has(token))
    .join(" ");
}

function normalizeJobTitle(value: string) {
  return normalizeText(value)
    .replace(/&/g, " and ")
    .replace(/\b(sr|sr\.)\b/g, "senior")
    .replace(/\b(vp)\b/g, "vice president")
    .replace(/[|/,:()\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLocationValue(value: string) {
  const normalized = normalizeText(value)
    .replace(/greater toronto area|gta/g, "toronto")
    .replace(/remote\s*\(?canada\)?/g, "remote canada")
    .replace(/remote\s*\(?us\)?/g, "remote usa")
    .replace(/[|/,:()\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || normalized === "location not detected") {
    return "";
  }

  if (normalized.includes("remote")) {
    if (normalized.includes("canada")) {
      return "remote canada";
    }

    if (normalized.includes("usa") || normalized.includes("united states") || normalized.includes("us")) {
      return "remote usa";
    }

    return "remote";
  }

  return uniq(
    normalized
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 1 && !LOCATION_STOPWORDS.has(token)),
  )
    .sort()
    .join(" ");
}

function normalizeCategoryValue(value: string | null) {
  return value
    ? normalizeText(value)
        .replace(/[|/,:()\-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

function normalizeRedirectUrl(value: string) {
  try {
    const url = new URL(value);
    const trackingParams = [
      "gh_jid",
      "gh_src",
      "lever-origin",
      "lever-source",
      "source",
      "utm_campaign",
      "utm_content",
      "utm_medium",
      "utm_source",
      "utm_term",
    ];

    for (const param of trackingParams) {
      url.searchParams.delete(param);
    }

    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const search = url.searchParams.toString();

    return `${url.origin.toLowerCase()}${pathname}${search ? `?${search}` : ""}`;
  } catch {
    return value.trim().toLowerCase();
  }
}

function parseListingTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isListingRecent(createdAt: string | null, now = Date.now()) {
  const timestamp = parseListingTimestamp(createdAt);

  if (timestamp === null) {
    return false;
  }

  return now - timestamp <= RECENT_LISTING_WINDOW_MS;
}

function countTokenHits(query: string, listing: JobSearchListing) {
  const queryTokens = tokenize(query);
  const title = normalizeText(listing.title);
  const description = normalizeText(listing.description);
  const titleHits = queryTokens.filter((token) => title.includes(token)).length;
  const descriptionHits = queryTokens.filter((token) => description.includes(token)).length;

  return {
    titleHits,
    descriptionHits,
    totalHits: titleHits * 2 + descriptionHits,
  };
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
  if (source.provider === "ashby") {
    return fetchAshbyBoardJobs(source);
  }

  if (source.provider === "greenhouse") {
    return fetchGreenhouseBoardJobs(source);
  }

  if (source.provider === "smartrecruiters") {
    return fetchSmartRecruitersCompanyJobs(source);
  }

  return fetchLeverSiteJobs(source);
}

function getProviderPriority(provider: JobSearchListing["provider"]) {
  if (
    provider === "ashby" ||
    provider === "greenhouse" ||
    provider === "lever" ||
    provider === "smartrecruiters"
  ) {
    return 4;
  }

  return 2;
}

function scoreCandidateQuality(candidate: SearchCandidate) {
  const descriptionScore = Math.min(candidate.listing.description.length, 1200);
  const salaryScore =
    candidate.listing.salaryMin || candidate.listing.salaryMax ? 200 : 0;
  const freshnessScore =
    (parseListingTimestamp(candidate.listing.createdAt) ?? 0) / 1_000_000_000_000;
  const queryScore = countTokenHits(candidate.query, candidate.listing).totalHits * 25;

  return (
    getProviderPriority(candidate.listing.provider) * 10_000 +
    descriptionScore +
    salaryScore +
    freshnessScore +
    queryScore
  );
}

function pickPreferredQuery(left: SearchCandidate, right: SearchCandidate) {
  const leftHits = countTokenHits(left.query, left.listing).totalHits;
  const rightHits = countTokenHits(right.query, right.listing).totalHits;

  if (rightHits > leftHits) {
    return right.query;
  }

  if (leftHits > rightHits) {
    return left.query;
  }

  return right.query.length > left.query.length ? right.query : left.query;
}

function mergeListings(preferred: JobSearchListing, secondary: JobSearchListing) {
  return {
    ...preferred,
    description:
      preferred.description.length >= secondary.description.length
        ? preferred.description
        : secondary.description,
    redirectUrl: preferred.redirectUrl || secondary.redirectUrl,
    salaryMin: preferred.salaryMin ?? secondary.salaryMin,
    salaryMax: preferred.salaryMax ?? secondary.salaryMax,
    createdAt: preferred.createdAt ?? secondary.createdAt,
    category: preferred.category ?? secondary.category,
    contractType: preferred.contractType ?? secondary.contractType,
    contractTime: preferred.contractTime ?? secondary.contractTime,
    location:
      preferred.location !== "Location not detected"
        ? preferred.location
        : secondary.location,
  } satisfies JobSearchListing;
}

function areLikelyDuplicate(left: JobSearchListing, right: JobSearchListing) {
  const leftUrl = normalizeRedirectUrl(left.redirectUrl);
  const rightUrl = normalizeRedirectUrl(right.redirectUrl);

  if (leftUrl && rightUrl && leftUrl === rightUrl) {
    return true;
  }

  const leftCompany = normalizeCompanyName(left.company);
  const rightCompany = normalizeCompanyName(right.company);

  if (!leftCompany || !rightCompany || leftCompany !== rightCompany) {
    return false;
  }

  const leftTitle = normalizeJobTitle(left.title);
  const rightTitle = normalizeJobTitle(right.title);

  if (!leftTitle || !rightTitle || leftTitle !== rightTitle) {
    return false;
  }

  const leftCategory = normalizeCategoryValue(left.category);
  const rightCategory = normalizeCategoryValue(right.category);

  if (leftCategory && rightCategory && leftCategory !== rightCategory) {
    return false;
  }

  const leftLocation = normalizeLocationValue(left.location);
  const rightLocation = normalizeLocationValue(right.location);

  if (!leftLocation || !rightLocation) {
    return true;
  }

  return leftLocation === rightLocation;
}

function mergeCandidate(existing: SearchCandidate, incoming: SearchCandidate) {
  const existingQuality = scoreCandidateQuality(existing);
  const incomingQuality = scoreCandidateQuality(incoming);
  const preferred = incomingQuality > existingQuality ? incoming : existing;
  const secondary = preferred === incoming ? existing : incoming;

  return {
    listing: mergeListings(preferred.listing, secondary.listing),
    query: pickPreferredQuery(existing, incoming),
  } satisfies SearchCandidate;
}

function registerCandidate(candidates: SearchCandidate[], incoming: SearchCandidate) {
  const duplicateIndex = candidates.findIndex((candidate) =>
    areLikelyDuplicate(candidate.listing, incoming.listing),
  );

  if (duplicateIndex === -1) {
    candidates.push(incoming);
    return;
  }

  candidates[duplicateIndex] = mergeCandidate(candidates[duplicateIndex], incoming);
}

export async function searchInternetJobs(args: {
  location: string;
  queries: string[];
  resultsPerPage?: number;
  extraPublicSources?: PublicJobBoardSource[];
}) {
  const candidates: SearchCandidate[] = [];
  const now = Date.now();
  const seenSources = new Set<string>();
  const publicSources = [...listPublicJobBoardSources(), ...(args.extraPublicSources ?? [])].filter(
    (source) => {
      const key = `${source.provider}:${source.key}`.toLowerCase();

      if (seenSources.has(key)) {
        return false;
      }

      seenSources.add(key);
      return true;
    },
  );
  const publicSourceResults = await Promise.allSettled(
    publicSources.map((source) => fetchPublicSourceListings(source)),
  );
  const publicListings = publicSourceResults
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .filter(
      (listing) =>
        matchesLocation(args.location, listing.location) &&
        isListingRecent(listing.createdAt, now),
    );

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
      if (!isListingRecent(listing.createdAt, now)) {
        continue;
      }

      registerCandidate(candidates, {
        listing,
        query: result.query,
      });
    }
  }

  for (const query of args.queries) {
    const filteredPublicListings = publicListings.filter((listing) => matchesQuery(query, listing));

    for (const listing of filteredPublicListings) {
      registerCandidate(candidates, {
        listing,
        query,
      });
    }
  }

  return candidates.sort((left, right) => {
    return (
      (parseListingTimestamp(right.listing.createdAt) ?? 0) -
      (parseListingTimestamp(left.listing.createdAt) ?? 0)
    );
  });
}

export function getMarketSourceSummary() {
  const publicSourceSummary = listPublicJobBoardSources();
  const providerLabels = uniq(publicSourceSummary.map((source) => source.provider));
  const countByProvider = {
    ashby: publicSourceSummary.filter((source) => source.provider === "ashby").length,
    greenhouse: publicSourceSummary.filter((source) => source.provider === "greenhouse").length,
    lever: publicSourceSummary.filter((source) => source.provider === "lever").length,
  };

  return {
    adzunaEnabled: runtimeFlags.hasAdzuna,
    publicSources: publicSourceSummary.length,
    countByProvider,
    providerLabels,
  };
}
