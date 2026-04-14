import path from "node:path";

import { zodTextFormat } from "openai/helpers/zod";

import { env } from "@/lib/config";
import { getOpenAIClient } from "@/lib/openai";
import {
  type AnalysisProvider,
  type CareerLane,
  ResumeParserResultSchema,
  type ResumeParserResult,
} from "@/lib/schemas";

const RESUME_PARSER_PROMPT = `
You are a strict resume parser for a single-user job search operating system.
Extract only information supported by the uploaded resume text.
Return structured output only.

Rules:
- summary should capture the candidate's through-line in 2 to 4 sentences
- coreSkills should focus on explicit, reusable strengths
- focusAreas should capture sector, domain, or functional emphasis
- highlightBullets should capture the strongest evidence-rich bullets present in the resume
- lane should be null when the resume does not support a confident choice
- yearsExperience should be null when it is not explicit or safely inferable
`.trim();

const COMMUNICATIONS_KEYWORDS = [
  "communications",
  "executive communications",
  "stakeholder",
  "public affairs",
  "media relations",
  "internal communications",
  "corporate affairs",
  "change communications",
];

const MARKETING_KEYWORDS = [
  "marketing",
  "partnerships",
  "go-to-market",
  "growth",
  "brand",
  "ecosystem",
  "alliances",
  "market development",
];

const COMMON_SKILLS = [
  "Executive Communications",
  "Stakeholder Management",
  "Strategic Communications",
  "Change Management",
  "Public Affairs",
  "Media Relations",
  "Internal Communications",
  "Crisis Communications",
  "Brand Strategy",
  "Growth Marketing",
  "Go-to-Market",
  "Partnerships",
  "Ecosystem Strategy",
  "Demand Generation",
  "Content Strategy",
  "Cross-Functional Leadership",
  "Program Leadership",
  "Regulated Sectors",
  "Healthcare",
  "Government Relations",
];

const COMMON_FOCUS_AREAS = [
  "Healthcare",
  "Financial Services",
  "Public Sector",
  "Regulated Industries",
  "Corporate Reputation",
  "Transformation",
  "Executive Advisory",
  "Growth Strategy",
  "Partnership Ecosystems",
  "Enterprise Marketing",
];

function normalizeText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\r/g, "").trim();
}

function splitLines(value: string) {
  return normalizeText(value)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function cleanupBullet(value: string) {
  return value
    .replace(/^[-*•]\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function detectLane(text: string): CareerLane | null {
  const normalized = text.toLowerCase();
  const communicationsScore = COMMUNICATIONS_KEYWORDS.filter((keyword) =>
    normalized.includes(keyword),
  ).length;
  const marketingScore = MARKETING_KEYWORDS.filter((keyword) =>
    normalized.includes(keyword),
  ).length;

  if (communicationsScore === 0 && marketingScore === 0) {
    return null;
  }

  if (communicationsScore > 0 && marketingScore > 0 && Math.abs(communicationsScore - marketingScore) <= 1) {
    return "hybrid_review";
  }

  return communicationsScore >= marketingScore
    ? "senior_communications"
    : "strategic_marketing_partnerships";
}

function detectYearsExperience(text: string) {
  const explicitMatch = text.match(/(\d{1,2})\+?\s+years(?:\s+of)?\s+experience/i);
  if (explicitMatch) {
    return Number(explicitMatch[1]);
  }

  return null;
}

function detectName(lines: string[]) {
  const candidate = lines.find((line) => {
    return (
      line.length >= 5 &&
      line.length <= 60 &&
      /^[A-Za-z][A-Za-z .'-]+$/.test(line) &&
      !/@|linkedin|www\.|http/i.test(line)
    );
  });

  return candidate ?? null;
}

function detectHeadline(lines: string[], parsedName: string | null) {
  const candidate = lines.find((line) => {
    return (
      line !== parsedName &&
      line.length >= 8 &&
      line.length <= 120 &&
      !/@|linkedin|www\.|http/i.test(line)
    );
  });

  return candidate ?? null;
}

function summarize(lines: string[], headline: string | null) {
  const candidates = lines.filter((line) => {
    return (
      line !== headline &&
      !/@|linkedin|www\.|http/i.test(line) &&
      line.length > 40
    );
  });

  if (candidates.length === 0) {
    return "Resume uploaded successfully, but the summary needs manual review.";
  }

  return candidates.slice(0, 3).join(" ").slice(0, 1200);
}

function extractHighlights(lines: string[]) {
  const metricHeavy = lines.filter((line) => /\d|%|\$|million|billion/i.test(line));
  const bullets = metricHeavy.length > 0 ? metricHeavy : lines.filter((line) => /^[-*•]/.test(line));

  return Array.from(new Set(bullets.map(cleanupBullet).filter(Boolean))).slice(0, 6);
}

function extractKeywordMatches(text: string, options: string[]) {
  const normalized = text.toLowerCase();
  return options.filter((option) => normalized.includes(option.toLowerCase())).slice(0, 8);
}

function heuristicParseResume(text: string): ResumeParserResult {
  const lines = splitLines(text);
  const parsedName = detectName(lines);
  const headline = detectHeadline(lines, parsedName);
  const lane = detectLane(text);
  const highlightBullets = extractHighlights(lines);

  return ResumeParserResultSchema.parse({
    parsedName,
    headline,
    lane,
    yearsExperience: detectYearsExperience(text),
    summary: summarize(lines, headline),
    coreSkills: extractKeywordMatches(text, COMMON_SKILLS),
    focusAreas: extractKeywordMatches(text, COMMON_FOCUS_AREAS),
    highlightBullets,
  });
}

function inferMimeType(file: File) {
  if (file.type) {
    return file.type;
  }

  const extension = path.extname(file.name).toLowerCase();

  if (extension === ".pdf") {
    return "application/pdf";
  }

  if (extension === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  return "text/plain";
}

async function extractTextFromFile(file: File) {
  const mimeType = inferMimeType(file);
  const buffer = Buffer.from(await file.arrayBuffer());

  if (mimeType === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });

    try {
      const parsed = await parser.getText();
      return normalizeText(parsed.text);
    } finally {
      await parser.destroy();
    }
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return normalizeText(result.value);
  }

  return normalizeText(buffer.toString("utf8"));
}

export async function parseUploadedResume(file: File): Promise<{
  rawText: string;
  parsed: ResumeParserResult;
  provider: AnalysisProvider;
}> {
  const rawText = (await extractTextFromFile(file)).slice(0, 40000);

  if (rawText.length < 120) {
    throw new Error("The uploaded resume did not contain enough readable text to parse.");
  }

  const client = getOpenAIClient();

  if (client) {
    try {
      const response = await client.responses.parse({
        model: env.OPENAI_PARSER_MODEL,
        instructions: RESUME_PARSER_PROMPT,
        input: rawText,
        text: {
          format: zodTextFormat(ResumeParserResultSchema, "resume_parser_result"),
        },
      });

      const parsed = ResumeParserResultSchema.parse(response.output_parsed);

      return {
        rawText,
        parsed,
        provider: "openai",
      };
    } catch (error) {
      console.error("OpenAI resume parser failed, falling back to heuristics.", error);
    }
  }

  return {
    rawText,
    parsed: heuristicParseResume(rawText),
    provider: "heuristic",
  };
}
