import { zodTextFormat } from "openai/helpers/zod";

import { env } from "@/lib/config";
import { getOpenAIClient } from "@/lib/openai";
import {
  type AnalysisProvider,
  type CareerLane,
  type JobScoreResult,
  JobScoreResultSchema,
  type RetrievedAchievement,
  type StoredAchievement,
  type StoredJob,
  type StoredProfile,
  type StoredResume,
} from "@/lib/schemas";

const FIT_SCORER_PROMPT = `
You are evaluating whether one job is worth pursuing for a single candidate.
Use only the parsed job, the selected resume, profile context, and retrieved achievements provided.
Do not invent experience, proof points, or hidden strengths.
Return structured output only.

Scoring rules:
- 80 to 100 = strong pursue
- 60 to 79 = maybe, needs selective positioning
- 0 to 59 = pass unless the user has unseen evidence outside the vault

Best-angle rules:
- bestAngle must describe the clearest positioning angle for this exact job
- resumeHighlights should capture the most useful parts of the selected resume for this job
- topProofPoints must be grounded in the retrieved achievements
- gaps must name what is still weak or missing
- hiddenObjections should capture concerns a hiring team may have but the posting may not state directly
`.trim();

const MODEL_SCORE_SCHEMA = JobScoreResultSchema.omit({
  retrievedAchievements: true,
});

const COMMON_STOPWORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "that",
  "from",
  "into",
  "your",
  "this",
  "have",
  "will",
  "role",
  "team",
  "work",
  "ability",
  "experience",
  "years",
  "year",
  "using",
  "through",
  "about",
  "their",
  "our",
  "you",
]);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !COMMON_STOPWORDS.has(token));
}

function uniq<T>(items: T[]) {
  return Array.from(new Set(items));
}

function normalizeLaneBonus(jobLane: CareerLane, achievementLane: CareerLane | null) {
  if (!achievementLane) {
    return 0;
  }

  if (jobLane === achievementLane) {
    return 18;
  }

  if (jobLane === "hybrid_review" || achievementLane === "hybrid_review") {
    return 8;
  }

  return -4;
}

function buildAchievementSummary(achievement: StoredAchievement) {
  const position =
    [achievement.roleTitle, achievement.company].filter(Boolean).join(" at ") ||
    "Relevant achievement";

  return `${position}: ${achievement.result}`.slice(0, 320);
}

function buildAchievementSearchText(achievement: StoredAchievement) {
  return [
    achievement.company,
    achievement.roleTitle,
    achievement.industry,
    achievement.situation,
    achievement.action,
    achievement.result,
    achievement.rawText,
    ...achievement.metrics,
    ...achievement.tags,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildResumeSearchText(resume: StoredResume) {
  return [
    resume.parsedName,
    resume.headline,
    resume.summary,
    ...resume.coreSkills,
    ...resume.focusAreas,
    ...resume.highlightBullets,
    resume.rawText,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildJobPhrases(job: StoredJob) {
  return uniq([
    job.title,
    job.company,
    ...job.analysis.mustHaves,
    ...job.analysis.niceToHaves,
    ...job.analysis.painPoints,
    ...job.analysis.fitSignalKeywords,
  ]).filter(Boolean);
}

function buildRetrievalEvidence(
  phrases: string[],
  achievementText: string,
  achievement: StoredAchievement,
  laneMatched: boolean,
) {
  const normalized = achievementText.toLowerCase();
  const evidence = new Set<string>();

  if (laneMatched) {
    evidence.add("Lane-aligned experience.");
  }

  for (const phrase of phrases) {
    if (normalized.includes(phrase.toLowerCase())) {
      evidence.add(`Matches job signal: ${phrase}`);
    }

    if (evidence.size >= 4) {
      break;
    }
  }

  if (achievement.metrics.length > 0) {
    evidence.add("Includes measurable business outcomes.");
  }

  return Array.from(evidence).slice(0, 4);
}

function buildResumeSignals(job: StoredJob, resume: StoredResume | null) {
  if (!resume) {
    return {
      score: 0,
      matchedKeywords: [] as string[],
      highlights: [] as string[],
    };
  }

  const text = buildResumeSearchText(resume);
  const normalized = text.toLowerCase();
  const jobPhrases = buildJobPhrases(job);
  const tokenHits = tokenize(jobPhrases.join(" ")).filter((token) =>
    normalized.includes(token),
  ).length;
  const phraseHits = jobPhrases.filter((phrase) =>
    normalized.includes(phrase.toLowerCase()),
  ).length;
  const laneBonus = normalizeLaneBonus(job.lane, resume.lane);
  const score = clamp(
    24 + laneBonus + tokenHits * 4 + phraseHits * 6 + resume.coreSkills.length * 2,
    0,
    100,
  );
  const matchedKeywords = jobPhrases
    .filter((phrase) => normalized.includes(phrase.toLowerCase()))
    .slice(0, 5);
  const highlights = resume.highlightBullets
    .filter((bullet) =>
      matchedKeywords.some((keyword) => bullet.toLowerCase().includes(keyword.toLowerCase())),
    )
    .slice(0, 3);

  return {
    score,
    matchedKeywords,
    highlights: highlights.length > 0 ? highlights : resume.highlightBullets.slice(0, 3),
  };
}

function buildResumeProofPoints(job: StoredJob, resume: StoredResume | null) {
  if (!resume) {
    return [];
  }

  const jobPhrases = buildJobPhrases(job);
  const titleTokens = tokenize(job.title);
  const candidateLines = uniq([
    ...resume.highlightBullets,
    ...resume.summary
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean),
  ]).slice(0, 10);

  const ranked = candidateLines
    .map((line) => {
      const normalized = line.toLowerCase();
      const phraseHits = jobPhrases.filter((phrase) =>
        normalized.includes(phrase.toLowerCase()),
      ).length;
      const tokenHits = titleTokens.filter((token) => normalized.includes(token)).length;
      const metricBonus = /\d|%|\$/.test(line) ? 2 : 0;

      return {
        line,
        score: phraseHits * 3 + tokenHits * 2 + metricBonus,
      };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  if (ranked.length > 0) {
    return ranked.slice(0, 3).map((item) => item.line);
  }

  return candidateLines.slice(0, 2);
}

function buildTitleAlignment(job: StoredJob, resume: StoredResume | null) {
  if (!resume) {
    return 0;
  }

  const normalizedResume = buildResumeSearchText(resume).toLowerCase();
  const titleTokens = tokenize(job.title);

  if (titleTokens.length === 0) {
    return resume.lane === job.lane ? 0.35 : 0;
  }

  const matchedTitleTokens = titleTokens.filter((token) =>
    normalizedResume.includes(token),
  ).length;
  const laneBonus = resume.lane === job.lane ? 0.25 : 0;

  return clamp(matchedTitleTokens / titleTokens.length + laneBonus, 0, 1);
}

function retrieveAchievements(
  job: StoredJob,
  achievements: StoredAchievement[],
): RetrievedAchievement[] {
  const jobPhrases = buildJobPhrases(job);
  const jobTokens = new Set(tokenize(jobPhrases.join(" ")));

  const ranked = achievements
    .map((achievement) => {
      const text = buildAchievementSearchText(achievement);
      const textLower = text.toLowerCase();
      const achievementTokens = new Set(tokenize(text));
      let tokenHits = 0;

      for (const token of jobTokens) {
        if (achievementTokens.has(token)) {
          tokenHits += 1;
        }
      }

      const phraseHits = jobPhrases.filter((phrase) =>
        textLower.includes(phrase.toLowerCase()),
      ).length;
      const laneBonus = normalizeLaneBonus(job.lane, achievement.lane);
      const score = clamp(
        20 + laneBonus + tokenHits * 4 + phraseHits * 6 + (achievement.metrics.length > 0 ? 5 : 0),
        0,
        100,
      );

      return {
        id: achievement.id,
        company: achievement.company,
        roleTitle: achievement.roleTitle,
        lane: achievement.lane,
        score,
        summary: buildAchievementSummary(achievement),
        evidence: buildRetrievalEvidence(jobPhrases, text, achievement, laneBonus > 0),
        metrics: achievement.metrics.slice(0, 4),
        tags: achievement.tags.slice(0, 4),
      } satisfies RetrievedAchievement;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 10);

  if (ranked.every((item) => item.score <= 24)) {
    return ranked.slice(0, 3);
  }

  return ranked.filter((item, index) => item.score > 24 || index < 3);
}

function buildGapList(
  job: StoredJob,
  retrieved: RetrievedAchievement[],
  resume: StoredResume | null,
) {
  const retrievedText = retrieved
    .flatMap((item) => [item.summary, ...item.evidence, ...item.metrics, ...item.tags])
    .join(" ")
    .toLowerCase();
  const resumeText = resume ? buildResumeSearchText(resume).toLowerCase() : "";
  const evidenceText = `${retrievedText} ${resumeText}`;

  const gaps = job.analysis.mustHaves.filter((mustHave) => {
    return !evidenceText.includes(mustHave.toLowerCase());
  });

  return gaps.slice(0, 4);
}

function deriveBestAngle(job: StoredJob, retrieved: RetrievedAchievement[]) {
  const lead = retrieved[0];

  if (job.lane === "senior_communications") {
    return lead
      ? `Lead with executive advisory, stakeholder alignment, and the outcome in "${lead.summary}".`
      : "Lead with executive advisory, stakeholder trust, and change communications experience.";
  }

  if (job.lane === "strategic_marketing_partnerships") {
    return lead
      ? `Lead with growth strategy, partnership execution, and the commercial result in "${lead.summary}".`
      : "Lead with growth strategy, partnerships, and measurable go-to-market outcomes.";
  }

  return lead
    ? `Lead with the hybrid strength that connects communications discipline to commercial outcomes, anchored by "${lead.summary}".`
    : "Lead with the rare mix of communications discipline and commercial strategy, but sharpen the lane before applying.";
}

function heuristicScore(
  job: StoredJob,
  profile: StoredProfile | null,
  resume: StoredResume | null,
  retrieved: RetrievedAchievement[],
): JobScoreResult {
  const proofPointCount = retrieved.filter((item) => item.score >= 30).length;
  const evidenceDepth = retrieved.reduce((count, item) => count + item.evidence.length, 0);
  const resumeSignals = buildResumeSignals(job, resume);
  const resumeProofPoints = buildResumeProofPoints(job, resume);
  const titleAlignment = buildTitleAlignment(job, resume);
  const groundedProofCount = Math.max(proofPointCount, resumeProofPoints.length);
  const gaps = buildGapList(job, retrieved, resume);
  const objections = [...job.analysis.likelyObjections];

  if (!profile) {
    objections.push("Profile context has not been filled in yet.");
  }

  if (!resume) {
    objections.push("No resume has been selected for this score.");
  }

  if (groundedProofCount === 0) {
    objections.push("The selected resume still needs stronger proof points for this role family.");
  }

  if (job.lane === "hybrid_review") {
    objections.push("Role still needs a sharper lane choice before generation.");
  }

  let score =
    34 +
    proofPointCount * 8 +
    Math.round(resumeSignals.score * 0.3) +
    Math.round(titleAlignment * 14) +
    Math.min(14, resumeProofPoints.length * 5) +
    Math.min(18, evidenceDepth * 2) -
    gaps.length * 4 -
    job.analysis.likelyObjections.length * 2;

  if (proofPointCount === 0 && resumeProofPoints.length > 0) {
    score += 8;
  }

  if (!profile) {
    score -= 4;
  }

  if (job.lane === "hybrid_review") {
    score -= 6;
  }

  if (!resume) {
    score = Math.min(score, 56);
  }

  score = clamp(score, 18, 96);

  const verdict =
    score >= 78 ? "pursue" : score >= 58 ? "maybe" : "pass";

  return JobScoreResultSchema.parse({
    score,
    verdict,
    bestAngle: deriveBestAngle(job, retrieved),
    topProofPoints:
      retrieved.length > 0
        ? retrieved.slice(0, 3).map((item) => item.summary)
        : resumeProofPoints.length > 0
          ? resumeProofPoints
          : resumeSignals.highlights,
    gaps: [
      ...gaps,
      ...(resume
        ? []
        : ["Upload and select a resume version so Hired can score against a real application asset."]),
      ...(resumeSignals.matchedKeywords.length > 0
        ? []
        : ["The selected resume does not clearly surface the strongest job signals yet."]),
    ].slice(0, 4),
    hiddenObjections: uniq(objections).slice(0, 5),
    resumeHighlights: resumeSignals.highlights,
    retrievedAchievements: retrieved,
  });
}

export async function scoreJobFit(args: {
  job: StoredJob;
  profile: StoredProfile | null;
  resume: StoredResume | null;
  achievements: StoredAchievement[];
  preferHeuristic?: boolean;
}): Promise<{
  result: JobScoreResult;
  provider: AnalysisProvider;
  model: string | null;
}> {
  const retrievedAchievements = retrieveAchievements(args.job, args.achievements);
  const client = getOpenAIClient();

  if (client && !args.preferHeuristic) {
    try {
      const response = await client.responses.parse({
        model: env.OPENAI_PARSER_MODEL,
        instructions: FIT_SCORER_PROMPT,
        input: JSON.stringify(
          {
            profile: args.profile
              ? {
                  name: args.profile.name,
                  targetRegion: args.profile.targetRegion,
                  yearsExperience: args.profile.yearsExperience,
                  masterSummary: args.profile.masterSummary,
                }
              : null,
            resume: args.resume
              ? {
                  id: args.resume.id,
                  label: args.resume.label,
                  parsedName: args.resume.parsedName,
                  headline: args.resume.headline,
                  lane: args.resume.lane,
                  yearsExperience: args.resume.yearsExperience,
                  summary: args.resume.summary,
                  coreSkills: args.resume.coreSkills,
                  focusAreas: args.resume.focusAreas,
                  highlightBullets: args.resume.highlightBullets,
                }
              : null,
            job: {
              id: args.job.id,
              company: args.job.company,
              title: args.job.title,
              lane: args.job.lane,
              level: args.job.level,
              mustHaves: args.job.analysis.mustHaves,
              niceToHaves: args.job.analysis.niceToHaves,
              painPoints: args.job.analysis.painPoints,
              likelyObjections: args.job.analysis.likelyObjections,
              fitSignalKeywords: args.job.analysis.fitSignalKeywords,
            },
            retrievedAchievements,
          },
          null,
          2,
        ),
        text: {
          format: zodTextFormat(MODEL_SCORE_SCHEMA, "fit_score_result"),
        },
      });

      const parsed = MODEL_SCORE_SCHEMA.parse(response.output_parsed);

      return {
        result: JobScoreResultSchema.parse({
          ...parsed,
          resumeHighlights: args.resume?.highlightBullets.slice(0, 3) ?? [],
          retrievedAchievements,
        }),
        provider: "openai",
        model: env.OPENAI_PARSER_MODEL,
      };
    } catch (error) {
      console.error("OpenAI fit scorer failed, falling back to heuristics.", error);
    }
  }

  return {
    result: heuristicScore(args.job, args.profile, args.resume, retrievedAchievements),
    provider: "heuristic",
    model: null,
  };
}
