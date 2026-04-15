import { randomUUID } from "node:crypto";

import { scoreJobFit } from "@/lib/ai/fit-scorer";
import { parseJobDescription } from "@/lib/ai/job-parser";
import {
  buildMatchReasons,
  buildResumeRecommendations,
} from "@/lib/ai/resume-strengthener";
import {
  searchAdzunaJobs,
  type AdzunaJobListing,
  detectAdzunaCountry,
} from "@/lib/job-search/adzuna";
import {
  type AnalysisProvider,
  type LocationSweepResult,
  LocationSweepResultSchema,
  type ParserProvider,
  type StoredAchievement,
  type StoredJob,
  type StoredProfile,
  type StoredResume,
  StoredJobSchema,
} from "@/lib/schemas";

const COMMUNICATIONS_SWEEP_QUERIES = [
  "communications manager",
  "communications director",
  "public affairs",
  "internal communications",
];

const MARKETING_SWEEP_QUERIES = [
  "marketing manager",
  "growth marketing",
  "partnerships manager",
  "go-to-market",
];
const LISTING_SIGNAL_KEYWORDS = [
  "executive communications",
  "communications",
  "public affairs",
  "stakeholder management",
  "stakeholder",
  "internal communications",
  "media relations",
  "healthcare",
  "government",
  "regulated",
  "growth marketing",
  "growth",
  "go-to-market",
  "brand strategy",
  "partnerships",
  "ecosystem",
];

function uniq(items: string[]) {
  return Array.from(new Set(items));
}

function normalizeTitleCandidate(value: string) {
  return value
    .replace(/[|/,:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function pickLane(resume: StoredResume | null, profile: StoredProfile | null) {
  if (resume?.lane) {
    return resume.lane;
  }

  const summary = profile?.masterSummary.toLowerCase() ?? "";

  if (/communications|public affairs|media relations|executive/i.test(summary)) {
    return "senior_communications";
  }

  if (/marketing|growth|partnership|go-to-market|brand/i.test(summary)) {
    return "strategic_marketing_partnerships";
  }

  return "hybrid_review";
}

function buildSweepQueries(profile: StoredProfile | null, resume: StoredResume | null) {
  const lane = pickLane(resume, profile);
  const directQueries = [
    resume?.headline,
    resume?.label,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeTitleCandidate(value))
    .filter((value) =>
      /(communications|comms|marketing|partnership|public affairs|growth|brand|stakeholder|corporate)/i.test(
        value,
      ),
    );

  const skillQueries = (resume?.coreSkills ?? [])
    .flatMap((skill) => {
      if (/public affairs/i.test(skill)) {
        return ["public affairs"];
      }

      if (/communications/i.test(skill)) {
        return ["communications manager"];
      }

      if (/growth marketing/i.test(skill)) {
        return ["growth marketing"];
      }

      if (/partnership/i.test(skill)) {
        return ["partnerships manager"];
      }

      if (/brand/i.test(skill)) {
        return ["brand strategy"];
      }

      return [];
    })
    .map((query) => normalizeTitleCandidate(query));

  const laneDefaults =
    lane === "senior_communications"
      ? COMMUNICATIONS_SWEEP_QUERIES
      : lane === "strategic_marketing_partnerships"
        ? MARKETING_SWEEP_QUERIES
        : uniq([...COMMUNICATIONS_SWEEP_QUERIES.slice(0, 2), ...MARKETING_SWEEP_QUERIES.slice(0, 2)]);

  return uniq([...directQueries, ...skillQueries, ...laneDefaults]).slice(0, 4);
}

function buildSearchDescription(listing: AdzunaJobListing, query: string) {
  return [
    `Title: ${listing.title}`,
    `Search query: ${query}`,
    `Company: ${listing.company}`,
    `Location: ${listing.location}`,
    listing.contractTime ? `Schedule: ${listing.contractTime}` : null,
    listing.contractType ? `Contract: ${listing.contractType}` : null,
    listing.description,
  ]
    .filter(Boolean)
    .join("\n");
}

function toTitleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function deriveListingSignals(listing: AdzunaJobListing, query: string) {
  const text = [listing.title, listing.category, listing.description, query]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return LISTING_SIGNAL_KEYWORDS.filter((keyword, index, all) => {
    return text.includes(keyword) && all.indexOf(keyword) === index;
  }).map(toTitleCase);
}

function buildTransientJob(args: {
  listing: AdzunaJobListing;
  description: string;
  parserProvider: ParserProvider;
  parsed: Awaited<ReturnType<typeof parseJobDescription>>["parsed"];
}) {
  const now = new Date().toISOString();

  return StoredJobSchema.parse({
    id: randomUUID(),
    source: `Adzuna • ${args.listing.location}`,
    company: args.listing.company || args.parsed.company,
    title: args.listing.title || args.parsed.title,
    description: args.description,
    lane: args.parsed.lane,
    level: args.parsed.level,
    fitScore: null,
    status: "new",
    parserProvider: args.parserProvider,
    analysis: {
      mustHaves: args.parsed.mustHaves,
      niceToHaves: args.parsed.niceToHaves,
      painPoints: args.parsed.painPoints,
      likelyObjections: args.parsed.likelyObjections,
      fitSignalKeywords: args.parsed.fitSignalKeywords,
      verdict: null,
      bestAngle: null,
      topProofPoints: [],
      gaps: [],
      hiddenObjections: [],
      resumeId: null,
      resumeName: null,
      resumeHighlights: [],
      retrievedAchievements: [],
      scoringProvider: null,
      scoringModel: null,
    },
    createdAt: now,
    updatedAt: now,
  });
}

async function scoreListing(args: {
  listing: AdzunaJobListing;
  query: string;
  profile: StoredProfile | null;
  resume: StoredResume;
  achievements: StoredAchievement[];
}) {
  const description = buildSearchDescription(args.listing, args.query);
  const { parsed, provider: parserProvider } = await parseJobDescription(description, {
    preferHeuristic: true,
  });
  const derivedSignals = deriveListingSignals(args.listing, args.query);
  const transientJob = buildTransientJob({
    listing: args.listing,
    description,
    parserProvider,
    parsed: {
      ...parsed,
      company: args.listing.company || parsed.company,
      title: args.listing.title || parsed.title,
      fitSignalKeywords: Array.from(
        new Set([...parsed.fitSignalKeywords, ...derivedSignals]),
      ).slice(0, 8),
    },
  });
  const { result, provider: scoringProvider, model } = await scoreJobFit({
    job: transientJob,
    profile: args.profile,
    resume: args.resume,
    achievements: args.achievements,
    preferHeuristic: true,
  });

  return {
    transientJob,
    parserProvider,
    result,
    scoringProvider,
    model,
  };
}

export async function runLocationSweep(args: {
  location: string;
  minScore: number;
  profile: StoredProfile | null;
  resume: StoredResume | null;
  achievements: StoredAchievement[];
}): Promise<LocationSweepResult> {
  if (!args.resume) {
    throw new Error("Upload and activate a resume before running a location sweep.");
  }

  const location = args.location.trim();

  if (!location) {
    throw new Error("Add a target region before running a location sweep.");
  }

  const queries = buildSweepQueries(args.profile, args.resume);

  if (queries.length === 0) {
    throw new Error("Hired could not derive job queries from the active resume yet.");
  }

  const country = detectAdzunaCountry(location);
  const seenExternalIds = new Set<string>();
  const candidates: Array<{
    listing: AdzunaJobListing;
    query: string;
  }> = [];

  for (const query of queries) {
    const listings = await searchAdzunaJobs({
      location,
      query,
      country,
      resultsPerPage: 8,
    });

    for (const listing of listings) {
      if (seenExternalIds.has(listing.id)) {
        continue;
      }

      seenExternalIds.add(listing.id);
      candidates.push({ listing, query });
    }
  }

  const matches = [];

  for (const candidate of candidates.slice(0, 24)) {
    const scored = await scoreListing({
      listing: candidate.listing,
      query: candidate.query,
      profile: args.profile,
      resume: args.resume,
      achievements: args.achievements,
    });

    if (scored.result.score < args.minScore) {
      continue;
    }

    matches.push({
      externalId: candidate.listing.id,
      source: "Adzuna",
      searchQuery: candidate.query,
      title: candidate.listing.title,
      company: candidate.listing.company,
      location: candidate.listing.location,
      redirectUrl: candidate.listing.redirectUrl,
      description: candidate.listing.description.slice(0, 4000),
      lane: scored.transientJob.lane,
      level: scored.transientJob.level,
      score: scored.result.score,
      verdict: scored.result.verdict,
      bestAngle: scored.result.bestAngle,
      topProofPoints: scored.result.topProofPoints.slice(0, 3),
      gaps: scored.result.gaps.slice(0, 3),
      hiddenObjections: scored.result.hiddenObjections.slice(0, 4),
      resumeHighlights: scored.result.resumeHighlights.slice(0, 3),
      matchReasons: buildMatchReasons({
        job: scored.transientJob,
        score: scored.result,
        resume: args.resume,
      }),
      resumeRecommendations: buildResumeRecommendations({
        job: scored.transientJob,
        score: scored.result,
        resume: args.resume,
      }),
      salaryMin: candidate.listing.salaryMin,
      salaryMax: candidate.listing.salaryMax,
      createdAt: candidate.listing.createdAt,
      parserProvider: scored.parserProvider,
      scoringProvider: scored.scoringProvider,
      scoringModel: scored.model,
    });
  }

  return LocationSweepResultSchema.parse({
    location,
    minScore: args.minScore,
    queries,
    matches: matches.sort((left, right) => right.score - left.score).slice(0, 20),
  });
}
