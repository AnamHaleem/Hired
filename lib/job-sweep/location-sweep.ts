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
  type RetrievedAchievement,
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
const TITLE_STOPWORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "global",
  "senior",
  "junior",
  "associate",
  "lead",
  "principal",
]);

type TitleFamily =
  | "communications"
  | "public_affairs"
  | "marketing"
  | "growth"
  | "brand"
  | "partnerships";

function uniq(items: string[]) {
  return Array.from(new Set(items));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function interpolateThreshold(args: {
  minScore: number;
  floor: number;
  ceiling: number;
  lowValue: number;
  highValue: number;
}) {
  const normalized = clamp(
    (args.minScore - args.floor) / (args.ceiling - args.floor),
    0,
    1,
  );

  return Math.round(args.lowValue + (args.highValue - args.lowValue) * normalized);
}

function normalizeTitleCandidate(value: string) {
  return value
    .replace(/[|/,:]+/g, " ")
    .replace(/\bcomms\b/gi, "communications")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function tokenizeTitle(value: string) {
  return normalizeTitleCandidate(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !TITLE_STOPWORDS.has(token));
}

function detectTitleFamilies(value: string) {
  const normalized = normalizeTitleCandidate(value).toLowerCase();
  const families = new Set<TitleFamily>();

  if (/communications|corporate communications|internal communications|media relations|executive communications|comms\b/i.test(normalized)) {
    families.add("communications");
  }

  if (/public affairs|government relations|reputation/i.test(normalized)) {
    families.add("public_affairs");
  }

  if (/\bmarketing\b|campaign/i.test(normalized)) {
    families.add("marketing");
  }

  if (/growth|acquisition|performance marketing/i.test(normalized)) {
    families.add("growth");
  }

  if (/\bbrand\b/i.test(normalized)) {
    families.add("brand");
  }

  if (/partnership|alliances|ecosystem|channel/i.test(normalized)) {
    families.add("partnerships");
  }

  return Array.from(families);
}

function detectTitleLevel(value: string) {
  const normalized = value.toLowerCase();

  if (/(vice president|vp\b|head of|chief|managing director)/i.test(normalized)) {
    return "vp_plus";
  }

  if (/(senior director|sr\. director|director)/i.test(normalized)) {
    return "director";
  }

  if (/(senior manager|sr\. manager|manager)/i.test(normalized)) {
    return "manager";
  }

  if (/(specialist|coordinator|consultant|advisor|partner|strategist|analyst)/i.test(normalized)) {
    return "individual";
  }

  return "unknown";
}

function scoreTitleLevelAlignment(resumeLevel: string, jobLevel: string) {
  if (resumeLevel === "unknown" || jobLevel === "unknown") {
    return 55;
  }

  if (resumeLevel === jobLevel) {
    return 100;
  }

  const ladder = ["individual", "manager", "director", "vp_plus"];
  const resumeIndex = ladder.indexOf(resumeLevel);
  const jobIndex = ladder.indexOf(jobLevel);

  if (resumeIndex === -1 || jobIndex === -1) {
    return 45;
  }

  const distance = Math.abs(resumeIndex - jobIndex);

  if (distance === 1) {
    return 72;
  }

  if (distance === 2) {
    return 38;
  }

  return 12;
}

function buildTitleFamilyQueries(args: {
  resume: StoredResume | null;
  profile: StoredProfile | null;
  minScore: number;
}) {
  const titleSource = [args.resume?.headline, args.resume?.label]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const families = detectTitleFamilies(titleSource);
  const level = detectTitleLevel(titleSource);
  const queries: string[] = [];

  const includeFamilyQueries = (family: TitleFamily) => {
    if (family === "communications") {
      queries.push(
        level === "director" || level === "vp_plus"
          ? "communications director"
          : "communications manager",
        "senior communications manager",
        "corporate communications manager",
      );

      if (args.minScore <= 75) {
        queries.push("communications specialist", "public affairs manager");
      }
      return;
    }

    if (family === "public_affairs") {
      queries.push(
        level === "director" || level === "vp_plus"
          ? "public affairs director"
          : "public affairs manager",
      );

      if (args.minScore <= 75) {
        queries.push("government relations manager");
      }
      return;
    }

    if (family === "marketing") {
      queries.push(
        level === "director" || level === "vp_plus"
          ? "marketing director"
          : "marketing manager",
      );

      if (args.minScore <= 75) {
        queries.push("marketing specialist", "communications manager");
      }
      return;
    }

    if (family === "growth") {
      queries.push(
        level === "director" || level === "vp_plus"
          ? "growth marketing director"
          : "growth marketing manager",
      );

      if (args.minScore <= 75) {
        queries.push("demand generation manager", "digital marketing manager");
      }
      return;
    }

    if (family === "brand") {
      queries.push(
        level === "director" || level === "vp_plus"
          ? "brand director"
          : "brand manager",
      );

      if (args.minScore <= 75) {
        queries.push("brand specialist");
      }
      return;
    }

    if (family === "partnerships") {
      queries.push(
        level === "director" || level === "vp_plus"
          ? "partnerships director"
          : "partnerships manager",
      );

      if (args.minScore <= 75) {
        queries.push("alliances manager", "channel partnerships manager");
      }
    }
  };

  for (const family of families) {
    includeFamilyQueries(family);
  }

  if (queries.length > 0) {
    return uniq(queries);
  }

  const lane = pickLane(args.resume, args.profile);

  return lane === "senior_communications"
    ? COMMUNICATIONS_SWEEP_QUERIES
    : lane === "strategic_marketing_partnerships"
      ? MARKETING_SWEEP_QUERIES
      : uniq([...COMMUNICATIONS_SWEEP_QUERIES.slice(0, 2), ...MARKETING_SWEEP_QUERIES.slice(0, 2)]);
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

function buildSweepQueries(
  profile: StoredProfile | null,
  resume: StoredResume | null,
  minScore: number,
) {
  const directQueries = [
    resume?.headline,
    resume?.label,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => normalizeTitleCandidate(value))
    .filter(
      (value) =>
        /(communications|marketing|partnership|public affairs|growth|brand|manager|director|lead|head)/i.test(
          value,
        ),
    );
  const titleFamilyQueries = buildTitleFamilyQueries({ profile, resume, minScore }).map(
    (query) => normalizeTitleCandidate(query),
  );

  return uniq([...directQueries, ...titleFamilyQueries]).slice(
    0,
    minScore <= 75 ? 6 : 4,
  );
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

function familiesShareLane(left: TitleFamily[], right: TitleFamily[]) {
  const communicationsFamilies = new Set<TitleFamily>(["communications", "public_affairs"]);
  const marketingFamilies = new Set<TitleFamily>(["marketing", "growth", "brand", "partnerships"]);
  const leftHasCommunications = left.some((family) => communicationsFamilies.has(family));
  const leftHasMarketing = left.some((family) => marketingFamilies.has(family));
  const rightHasCommunications = right.some((family) => communicationsFamilies.has(family));
  const rightHasMarketing = right.some((family) => marketingFamilies.has(family));

  return (
    (leftHasCommunications && rightHasCommunications) ||
    (leftHasMarketing && rightHasMarketing)
  );
}

function scoreTitleAlignment(job: StoredJob, resume: StoredResume) {
  const resumeTitle = [resume.headline, resume.label]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const resumeFamilies = detectTitleFamilies(resumeTitle);
  const jobFamilies = detectTitleFamilies(job.title);
  const resumeTokens = tokenizeTitle(resumeTitle);
  const jobTokens = tokenizeTitle(job.title);
  const sharedFamilies = resumeFamilies.filter((family) => jobFamilies.includes(family));
  const sharedTokens = jobTokens.filter((token) => resumeTokens.includes(token));
  const familyScore =
    sharedFamilies.length > 0
      ? 100
      : familiesShareLane(resumeFamilies, jobFamilies)
        ? 52
        : resumeFamilies.length === 0 || jobFamilies.length === 0
          ? 30
          : 0;
  const levelScore = scoreTitleLevelAlignment(
    detectTitleLevel(resumeTitle),
    detectTitleLevel(job.title),
  );
  const tokenScore =
    jobTokens.length > 0
      ? Math.round((sharedTokens.length / jobTokens.length) * 100)
      : 0;
  const boostedFamilyScore =
    sharedFamilies.length > 0
      ? Math.min(
          100,
          88 +
            (sharedTokens.length >= Math.max(1, Math.ceil(jobTokens.length / 2)) ? 10 : 0) +
            (levelScore >= 72 ? 6 : levelScore >= 55 ? 4 : 0),
        )
      : 0;

  return {
    score:
      sharedFamilies.length > 0
        ? Math.max(
            boostedFamilyScore,
            Math.round(familyScore * 0.6 + levelScore * 0.2 + tokenScore * 0.2),
          )
        : Math.round(familyScore * 0.6 + levelScore * 0.2 + tokenScore * 0.2),
    sharedFamilies,
    sharedTokens,
    resumeTitle: resumeTitle || resume.label,
  };
}

function buildResponsibilitySignals(job: StoredJob) {
  return uniq([
    ...job.analysis.mustHaves,
    ...job.analysis.painPoints,
    ...job.analysis.fitSignalKeywords,
  ])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function scoreResponsibilityAlignment(args: {
  job: StoredJob;
  resume: StoredResume;
  retrievedAchievements: RetrievedAchievement[];
}) {
  const signals = buildResponsibilitySignals(args.job);
  const corpus = [
    args.resume.summary,
    ...args.resume.coreSkills,
    ...args.resume.focusAreas,
    ...args.resume.highlightBullets,
    args.resume.rawText,
    ...args.retrievedAchievements.flatMap((achievement) => [
      achievement.summary,
      ...achievement.evidence,
      ...achievement.metrics,
      ...achievement.tags,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const matchedSignals: string[] = [];

  for (const signal of signals) {
    const normalizedSignal = signal.toLowerCase();
    const signalTokens = tokenizeTitle(signal);
    const matchedTokenCount = signalTokens.filter((token) =>
      corpus.includes(token),
    ).length;
    const tokenCoverage =
      signalTokens.length > 0 ? matchedTokenCount / signalTokens.length : 0;

    if (corpus.includes(normalizedSignal) || tokenCoverage >= 0.55) {
      matchedSignals.push(signal);
    }
  }

  if (signals.length === 0) {
    return {
      score: 35,
      matchedSignals,
      totalSignals: 0,
    };
  }

  return {
    score: Math.round((matchedSignals.length / signals.length) * 100),
    matchedSignals,
    totalSignals: signals.length,
  };
}

function scoreLaneAlignment(job: StoredJob, resume: StoredResume) {
  if (!resume.lane) {
    return 60;
  }

  if (resume.lane === job.lane) {
    return 100;
  }

  if (resume.lane === "hybrid_review" || job.lane === "hybrid_review") {
    return 62;
  }

  return 0;
}

function buildStrictSweepScore(args: {
  job: StoredJob;
  resume: StoredResume;
  baseScore: number;
  retrievedAchievements: RetrievedAchievement[];
}) {
  const titleAlignment = scoreTitleAlignment(args.job, args.resume);
  const responsibilityAlignment = scoreResponsibilityAlignment({
    job: args.job,
    resume: args.resume,
    retrievedAchievements: args.retrievedAchievements,
  });
  const laneAlignment = scoreLaneAlignment(args.job, args.resume);
  const weightedAlignment = Math.round(
    titleAlignment.score * 0.75 +
      responsibilityAlignment.score * 0.15 +
      laneAlignment * 0.1,
  );
  const strictScore = Math.min(args.baseScore, weightedAlignment);

  return {
    strictScore,
    titleAlignment,
    responsibilityAlignment,
    laneAlignment,
  };
}

function buildAdaptiveSweepGates(minScore: number) {
  return {
    titleGate: interpolateThreshold({
      minScore,
      floor: 60,
      ceiling: 95,
      lowValue: 48,
      highValue: 72,
    }),
    responsibilityGate: interpolateThreshold({
      minScore,
      floor: 60,
      ceiling: 95,
      lowValue: 12,
      highValue: 34,
    }),
    laneGate: interpolateThreshold({
      minScore,
      floor: 60,
      ceiling: 95,
      lowValue: 34,
      highValue: 62,
    }),
  };
}

function getSweepSearchBreadth(minScore: number) {
  if (minScore <= 70) {
    return {
      resultsPerPage: 16,
      candidateLimit: 48,
    };
  }

  if (minScore <= 75) {
    return {
      resultsPerPage: 12,
      candidateLimit: 36,
    };
  }

  return {
    resultsPerPage: 8,
    candidateLimit: 24,
  };
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

  const queries = buildSweepQueries(args.profile, args.resume, args.minScore);

  if (queries.length === 0) {
    throw new Error("Hired could not derive job queries from the active resume yet.");
  }

  const country = detectAdzunaCountry(location);
  const gates = buildAdaptiveSweepGates(args.minScore);
  const searchBreadth = getSweepSearchBreadth(args.minScore);
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
      resultsPerPage: searchBreadth.resultsPerPage,
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

  for (const candidate of candidates.slice(0, searchBreadth.candidateLimit)) {
    const scored = await scoreListing({
      listing: candidate.listing,
      query: candidate.query,
      profile: args.profile,
      resume: args.resume,
      achievements: args.achievements,
    });
    const strictAlignment = buildStrictSweepScore({
      job: scored.transientJob,
      resume: args.resume,
      baseScore: scored.result.score,
      retrievedAchievements: scored.result.retrievedAchievements,
    });

    if (strictAlignment.titleAlignment.score < gates.titleGate) {
      continue;
    }

    if (strictAlignment.responsibilityAlignment.score < gates.responsibilityGate) {
      continue;
    }

    if (strictAlignment.laneAlignment < gates.laneGate) {
      continue;
    }

    if (strictAlignment.strictScore < args.minScore) {
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
      score: strictAlignment.strictScore,
      verdict: scored.result.verdict,
      bestAngle: scored.result.bestAngle,
      topProofPoints: scored.result.topProofPoints.slice(0, 3),
      gaps: scored.result.gaps.slice(0, 3),
      hiddenObjections: scored.result.hiddenObjections.slice(0, 4),
      resumeHighlights: scored.result.resumeHighlights.slice(0, 3),
      matchReasons: uniq([
        strictAlignment.titleAlignment.resumeTitle
          ? `Title alignment is strong between "${strictAlignment.titleAlignment.resumeTitle}" and "${candidate.listing.title}".`
          : null,
        strictAlignment.responsibilityAlignment.matchedSignals.length > 0
          ? `Responsibility overlap is grounded in ${strictAlignment.responsibilityAlignment.matchedSignals
              .slice(0, 2)
              .map((signal) => signal.toLowerCase())
              .join(" and ")}.`
          : null,
        ...buildMatchReasons({
          job: scored.transientJob,
          score: scored.result,
          resume: args.resume,
        }),
      ].filter((value): value is string => Boolean(value))).slice(0, 4),
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
