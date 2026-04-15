import { zodTextFormat } from "openai/helpers/zod";

import { env } from "@/lib/config";
import { getOpenAIClient } from "@/lib/openai";
import { getActiveResume } from "@/lib/persistence/resume-store";
import {
  type AnalysisProvider,
  type CreateAchievementInput,
  CreateAchievementInputSchema,
  type ParseAchievementInput,
  ParseAchievementResultSchema,
} from "@/lib/schemas";

const ACHIEVEMENT_PARSER_PROMPT = `
You extract grounded achievement drafts for a single candidate role history.
Use only the provided role context and resume evidence.
Return 1 to 6 structured achievement drafts.

Rules:
- every achievement must be distinct
- situation should describe the challenge, mandate, or operating context
- action should describe what the candidate led, built, changed, or influenced
- result should describe what changed and keep explicit outcomes when present
- metrics must include only explicit numbers, percentages, currency values, or counts
- tags should be short reusable themes like executive communications, stakeholder management, healthcare, go-to-market
- never invent employers, titles, metrics, or outcomes that are not supported by the text
`.trim();

const ACTION_VERBS = new Set([
  "advised",
  "built",
  "created",
  "delivered",
  "developed",
  "drove",
  "executed",
  "grew",
  "improved",
  "launched",
  "led",
  "managed",
  "owned",
  "partnered",
  "scaled",
  "shaped",
  "strengthened",
  "transformed",
]);

const TAG_KEYWORDS: Array<{ keyword: string; tag: string }> = [
  { keyword: "executive", tag: "executive communications" },
  { keyword: "stakeholder", tag: "stakeholder management" },
  { keyword: "media", tag: "media relations" },
  { keyword: "internal", tag: "internal communications" },
  { keyword: "change", tag: "change communications" },
  { keyword: "brand", tag: "brand strategy" },
  { keyword: "marketing", tag: "marketing strategy" },
  { keyword: "campaign", tag: "campaign leadership" },
  { keyword: "partnership", tag: "partnerships" },
  { keyword: "launch", tag: "go-to-market" },
  { keyword: "growth", tag: "growth strategy" },
  { keyword: "healthcare", tag: "healthcare" },
  { keyword: "public sector", tag: "public sector" },
  { keyword: "finance", tag: "financial services" },
  { keyword: "regulatory", tag: "regulated industries" },
];

type EvidenceLine = {
  source: "resume" | "roleContext";
  text: string;
};

function normalizeText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\r/g, "").trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function splitEvidenceLines(value: string, source: EvidenceLine["source"]) {
  return normalizeText(value)
    .split(/\n+/)
    .flatMap((line) => line.split(/\s*[•·]\s*|\s+-\s+(?=[A-Z])/))
    .map((line) => line.replace(/^[-*•]\s*/, "").replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 24)
    .map((text) => ({ source, text }));
}

function extractMetrics(text: string) {
  const matches =
    text.match(
      /\b(?:\$?\d[\d,]*(?:\.\d+)?(?:%|\s*(?:percent|percentage points?|x|k|m|b|million|billion|months?|weeks?|days?|people|leaders|campaigns?|launches?))?)\b/gi,
    ) ?? [];

  return Array.from(new Set(matches.map((match) => match.trim()))).slice(0, 6);
}

function deriveTags(text: string, input: ParseAchievementInput) {
  const normalized = text.toLowerCase();
  const tags = new Map<string, string>();

  function addTag(value: string) {
    const normalizedValue = value.trim().toLowerCase();
    if (!normalizedValue) {
      return;
    }

    tags.set(normalizedValue, value.trim());
  }

  for (const entry of TAG_KEYWORDS) {
    if (normalized.includes(entry.keyword)) {
      addTag(entry.tag);
    }
  }

  if (input.industry) {
    addTag(input.industry.trim());
  }

  if (input.lane === "senior_communications") {
    addTag("communications");
  }

  if (input.lane === "strategic_marketing_partnerships") {
    addTag("marketing");
  }

  if (input.lane === "hybrid_review") {
    addTag("hybrid leadership");
  }

  return Array.from(tags.values()).slice(0, 6);
}

function buildSituation(input: ParseAchievementInput) {
  const scope = [input.roleTitle, input.company].filter(Boolean).join(" at ");
  const industry = input.industry ? ` in ${input.industry}` : "";

  if (scope) {
    return `${scope}${industry} required high-trust delivery, cross-functional alignment, and measurable outcomes.`;
  }

  if (input.industry) {
    return `This role in ${input.industry} required high-trust delivery, cross-functional alignment, and measurable outcomes.`;
  }

  return "Role context parsed from the available resume and role notes.";
}

function buildAction(text: string) {
  const normalized = normalizeText(text);
  const split = normalized.split(
    /\b(?:resulting in|leading to|which led to|driving|delivering|improving)\b/i,
  );
  const candidate = split[0]?.replace(/[,:;.\s]+$/, "").trim() ?? normalized;

  return candidate.length >= 12 ? candidate : normalized;
}

function hasAchievementSignal(text: string) {
  const normalized = normalizeText(text).toLowerCase();
  const firstToken = normalized.split(/\s+/)[0] ?? "";

  return extractMetrics(text).length > 0 || ACTION_VERBS.has(firstToken);
}

function buildDraft(text: string, input: ParseAchievementInput): CreateAchievementInput | null {
  const normalized = normalizeText(text);

  if (normalized.length < 24 || !hasAchievementSignal(normalized)) {
    return null;
  }

  const draft = CreateAchievementInputSchema.safeParse({
    company: input.company?.trim() || undefined,
    roleTitle: input.roleTitle?.trim() || undefined,
    lane: input.lane ?? null,
    industry: input.industry?.trim() || undefined,
    situation: buildSituation(input),
    action: buildAction(normalized),
    result: normalized,
    metrics: extractMetrics(normalized),
    tags: deriveTags(normalized, input),
    rawText: normalized,
  });

  return draft.success ? draft.data : null;
}

function rankEvidenceLine(line: EvidenceLine, input: ParseAchievementInput) {
  const normalized = line.text.toLowerCase();
  const roleTokens = new Set(
    [input.company, input.roleTitle, input.industry]
      .filter(Boolean)
      .flatMap((value) => tokenize(value ?? "")),
  );

  let score = line.source === "roleContext" ? 12 : 6;

  if (extractMetrics(line.text).length > 0) {
    score += 10;
  }

  if (ACTION_VERBS.has(normalized.split(/\s+/)[0] ?? "")) {
    score += 6;
  }

  for (const token of roleTokens) {
    if (normalized.includes(token)) {
      score += 4;
    }
  }

  if (line.text.length >= 48 && line.text.length <= 260) {
    score += 3;
  }

  return score;
}

function heuristicParseAchievements(input: ParseAchievementInput, resumeText: string | null) {
  const seen = new Set<string>();
  const evidenceLines = [
    ...(input.roleContext ? splitEvidenceLines(input.roleContext, "roleContext") : []),
    ...(resumeText ? splitEvidenceLines(resumeText, "resume") : []),
  ]
    .filter((line) => {
      const key = line.text.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((left, right) => rankEvidenceLine(right, input) - rankEvidenceLine(left, input));

  const drafts = evidenceLines
    .map((line) => buildDraft(line.text, input))
    .filter((draft): draft is CreateAchievementInput => Boolean(draft))
    .slice(0, 6);

  if (drafts.length === 0) {
    throw new Error(
      "We could not find enough role evidence to parse achievements. Add role notes or upload a stronger resume version first.",
    );
  }

  return drafts;
}

export async function parseAchievementsFromRole(input: ParseAchievementInput): Promise<{
  achievements: CreateAchievementInput[];
  provider: AnalysisProvider;
}> {
  const activeResume = await getActiveResume();
  const resumeText = activeResume?.rawText ?? null;

  if (!input.roleContext?.trim() && !resumeText) {
    throw new Error("Upload a resume or paste role notes before parsing achievements.");
  }

  const client = getOpenAIClient();

  if (client) {
    try {
      const response = await client.responses.parse({
        model: env.OPENAI_PARSER_MODEL,
        instructions: ACHIEVEMENT_PARSER_PROMPT,
        input: JSON.stringify({
          role: {
            company: input.company ?? null,
            roleTitle: input.roleTitle ?? null,
            lane: input.lane ?? null,
            industry: input.industry ?? null,
            roleContext: input.roleContext ?? null,
          },
          resumeEvidence: resumeText ? resumeText.slice(0, 18000) : null,
        }),
        text: {
          format: zodTextFormat(ParseAchievementResultSchema, "achievement_parse_result"),
        },
      });

      const parsed = ParseAchievementResultSchema.parse(response.output_parsed);

      return {
        achievements: parsed.achievements.map((achievement) =>
          CreateAchievementInputSchema.parse({
            company: achievement.company ?? input.company ?? undefined,
            roleTitle: achievement.roleTitle ?? input.roleTitle ?? undefined,
            lane: achievement.lane ?? input.lane ?? null,
            industry: achievement.industry ?? input.industry ?? undefined,
            situation: achievement.situation,
            action: achievement.action,
            result: achievement.result,
            metrics: achievement.metrics,
            tags: achievement.tags,
            rawText: achievement.rawText,
          }),
        ),
        provider: "openai",
      };
    } catch (error) {
      console.error("OpenAI achievement parser failed, falling back to heuristics.", error);
    }
  }

  return {
    achievements: heuristicParseAchievements(input, resumeText),
    provider: "heuristic",
  };
}
