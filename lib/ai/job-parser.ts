import { zodTextFormat } from "openai/helpers/zod";

import { env } from "@/lib/config";
import { getOpenAIClient } from "@/lib/openai";
import {
  type CareerLane,
  JobLevelSchema,
  JobParserResultSchema,
  type JobParserResult,
  type ParserProvider,
} from "@/lib/schemas";

const JOB_PARSER_PROMPT = `
You are a strict job description parser for a human-reviewed job search operating system.
Extract only what is directly supported by the pasted description.
Return structured output that matches the schema exactly.

Lane rules:
- senior_communications = roles centered on executive communications, corporate communications, change communications, internal communications, public affairs, media relations, or stakeholder communications.
- strategic_marketing_partnerships = roles centered on strategic marketing, growth marketing, go-to-market, partnerships, alliances, market development, or ecosystem strategy.
- hybrid_review = use only when the role genuinely mixes both lanes and a clean route would be misleading.

Level rules:
- vp_plus, senior_director, director, senior_manager, manager, unknown.

Do not invent company names, requirements, or objections.
Keep list fields concise and evidence-backed.
`.trim();

const COMMUNICATIONS_KEYWORDS = [
  "communications",
  "public affairs",
  "media relations",
  "internal communications",
  "executive communications",
  "stakeholder",
  "reputation",
  "change management",
  "corporate affairs",
];

const MARKETING_KEYWORDS = [
  "marketing",
  "growth",
  "demand generation",
  "partnerships",
  "alliances",
  "ecosystem",
  "go-to-market",
  "gtm",
  "brand strategy",
];

function splitMeaningfulLines(description: string) {
  return description
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function cleanupLine(line: string) {
  return line
    .replace(/^[-*•\d.)\s]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function titleCaseFallback(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function detectTitle(lines: string[]) {
  const titleMatch = lines.find(
    (line) =>
      /title[:\-]/i.test(line) ||
      /(manager|director|communications|marketing|partnerships|public affairs|lead|head)/i.test(
        line,
      ),
  );

  if (!titleMatch) {
    return "Role title not detected";
  }

  const normalized = cleanupLine(titleMatch.replace(/^(job title|title)\s*[:\-]\s*/i, ""));
  return normalized || "Role title not detected";
}

function detectCompany(lines: string[]) {
  const companyMatch = lines.find((line) => /company[:\-]/i.test(line));

  if (companyMatch) {
    const normalized = cleanupLine(
      companyMatch.replace(/^company\s*[:\-]\s*/i, ""),
    );
    return normalized || "Company not detected";
  }

  const likelyCompany = lines.find(
    (line) =>
      line.length < 80 &&
      !/(manager|director|communications|marketing|partnerships|responsibilities|qualifications)/i.test(
        line,
      ),
  );

  return likelyCompany ? cleanupLine(likelyCompany) : "Company not detected";
}

function countKeywordHits(input: string, keywords: string[]) {
  return keywords.reduce((count, keyword) => {
    return count + (input.includes(keyword) ? 1 : 0);
  }, 0);
}

function detectLane(description: string): CareerLane {
  const normalized = description.toLowerCase();
  const communicationsScore = countKeywordHits(normalized, COMMUNICATIONS_KEYWORDS);
  const marketingScore = countKeywordHits(normalized, MARKETING_KEYWORDS);

  if (communicationsScore > 0 && marketingScore > 0 && Math.abs(communicationsScore - marketingScore) <= 1) {
    return "hybrid_review";
  }

  if (communicationsScore >= marketingScore) {
    return "senior_communications";
  }

  return "strategic_marketing_partnerships";
}

function detectLevel(description: string) {
  const normalized = description.toLowerCase();
  const candidates = [
    ["vp_plus", /(vice president|vp\b|head of|chief)/i],
    ["senior_director", /(senior director|sr\. director)/i],
    ["director", /\bdirector\b/i],
    ["senior_manager", /(senior manager|sr\. manager)/i],
    ["manager", /\bmanager\b/i],
  ] as const;

  for (const [level, pattern] of candidates) {
    if (pattern.test(normalized)) {
      return JobLevelSchema.parse(level);
    }
  }

  return "unknown";
}

function extractMatchingLines(
  lines: string[],
  patterns: RegExp[],
  limit = 6,
) {
  const matches = new Set<string>();

  for (const line of lines) {
    if (patterns.some((pattern) => pattern.test(line))) {
      const cleaned = cleanupLine(line);
      if (cleaned) {
        matches.add(cleaned);
      }
    }

    if (matches.size >= limit) {
      break;
    }
  }

  return Array.from(matches);
}

function detectLikelyObjections(description: string, lane: CareerLane) {
  const objections = new Set<string>();
  const normalized = description.toLowerCase();

  if (lane === "hybrid_review") {
    objections.add("Role mixes multiple lanes and may need sharper positioning.");
  }

  if (!/(people management|team leadership|managed a team|people leader)/i.test(normalized)) {
    objections.add("Direct people leadership may not be explicit.");
  }

  if (!/(regulated|healthcare|financial services|public sector|government|risk)/i.test(normalized)) {
    objections.add("Regulated-sector context may need to be established manually.");
  }

  return Array.from(objections).slice(0, 4);
}

function detectFitSignalKeywords(description: string) {
  const normalized = description.toLowerCase();
  const matched = [
    ...COMMUNICATIONS_KEYWORDS,
    ...MARKETING_KEYWORDS,
    "stakeholder management",
    "executive advisory",
    "transformation",
    "change management",
  ].filter((keyword, index, all) => {
    return normalized.includes(keyword) && all.indexOf(keyword) === index;
  });

  return matched.slice(0, 8).map(titleCaseFallback);
}

function heuristicParse(description: string): JobParserResult {
  const lines = splitMeaningfulLines(description);
  const lane = detectLane(description);

  return JobParserResultSchema.parse({
    company: detectCompany(lines),
    title: detectTitle(lines),
    lane,
    level: detectLevel(description),
    mustHaves: extractMatchingLines(lines, [
      /(required|requirements|must have|must-haves|you bring|what you bring)/i,
      /(experience with|experience in|proven track record)/i,
    ]),
    niceToHaves: extractMatchingLines(lines, [/(nice to have|preferred|bonus|asset)/i]),
    painPoints: extractMatchingLines(lines, [
      /(responsible for|you will|lead|drive|own|build|transform)/i,
    ]),
    likelyObjections: detectLikelyObjections(description, lane),
    fitSignalKeywords: detectFitSignalKeywords(description),
  });
}

export async function parseJobDescription(
  description: string,
  options?: {
    preferHeuristic?: boolean;
  },
): Promise<{ parsed: JobParserResult; provider: ParserProvider }> {
  const client = getOpenAIClient();

  if (client && !options?.preferHeuristic) {
    try {
      const response = await client.responses.parse({
        model: env.OPENAI_PARSER_MODEL,
        instructions: JOB_PARSER_PROMPT,
        input: description,
        text: {
          format: zodTextFormat(JobParserResultSchema, "job_parser_result"),
        },
      });

      const parsed = JobParserResultSchema.parse(response.output_parsed);

      return {
        parsed,
        provider: "openai",
      };
    } catch (error) {
      console.error("OpenAI parser failed, falling back to heuristics.", error);
    }
  }

  return {
    parsed: heuristicParse(description),
    provider: "heuristic",
  };
}
