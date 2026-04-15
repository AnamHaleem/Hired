import {
  type JobScoreResult,
  type StoredJob,
  type StoredResume,
} from "@/lib/schemas";

function uniq(items: string[]) {
  return Array.from(new Set(items));
}

function normalizeText(value: string) {
  return value.toLowerCase();
}

function buildResumeSearchText(resume: StoredResume | null) {
  if (!resume) {
    return "";
  }

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
    .join(" ")
    .toLowerCase();
}

function getJobTitleAnchor(title: string) {
  return title.replace(/\s+/g, " ").trim().slice(0, 90);
}

export function buildResumeRecommendations(args: {
  job: StoredJob;
  score: JobScoreResult;
  resume: StoredResume | null;
}) {
  const recommendations: string[] = [];
  const resumeText = buildResumeSearchText(args.resume);
  const headline = args.resume?.headline ? normalizeText(args.resume.headline) : "";
  const titleAnchor = getJobTitleAnchor(args.job.title);
  const matchedSignals = args.job.analysis.fitSignalKeywords.filter((signal) =>
    resumeText.includes(signal.toLowerCase()),
  );
  const missingSignals = uniq([
    ...args.job.analysis.mustHaves,
    ...args.job.analysis.fitSignalKeywords,
  ]).filter((signal) => !resumeText.includes(signal.toLowerCase()));

  if (args.resume && !headline.includes(args.job.title.toLowerCase().split(" ")[0] ?? "")) {
    recommendations.push(
      `Retune the headline and top summary toward "${titleAnchor}" language so the role fit is obvious in the first scan.`,
    );
  }

  for (const gap of args.score.gaps.slice(0, 2)) {
    recommendations.push(
      `Add a quantified bullet that proves ${gap.toLowerCase()} instead of leaving that signal implied.`,
    );
  }

  for (const signal of missingSignals.slice(0, 2)) {
    recommendations.push(
      `Mirror "${signal}" explicitly in the summary, skills block, or one recent bullet so the ATS and recruiter see it immediately.`,
    );
  }

  if (!args.resume?.highlightBullets.some((bullet) => /\d|%|\$/.test(bullet))) {
    recommendations.push(
      "Move one metric-backed bullet into the top third of this resume version so the strongest evidence appears before the first scroll.",
    );
  }

  if (args.score.topProofPoints[0]) {
    recommendations.push(
      `Pull the proof point "${args.score.topProofPoints[0]}" closer to the top of the resume and tie it to the job's core ask.`,
    );
  }

  if (matchedSignals.length > 0) {
    recommendations.push(
      `Keep the exact posting language for ${matchedSignals.slice(0, 2).join(" and ")} in the resume so this already-strong match stays easy to validate.`,
    );
  }

  return uniq(recommendations).slice(0, 4);
}

export function buildMatchReasons(args: {
  job: StoredJob;
  score: JobScoreResult;
  resume: StoredResume | null;
}) {
  const reasons = [
    ...args.job.analysis.fitSignalKeywords.slice(0, 2).map(
      (signal) => `Resume and posting both center ${signal.toLowerCase()}.`,
    ),
    ...args.score.topProofPoints.slice(0, 2).map(
      (proof) => `Proof point already supporting this role: ${proof}`,
    ),
  ];

  return uniq(reasons).slice(0, 4);
}
