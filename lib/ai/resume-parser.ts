import { createRequire } from "node:module";
import path from "node:path";

import { zodTextFormat } from "openai/helpers/zod";

import { env } from "@/lib/config";
import { getOpenAIClient } from "@/lib/openai";
import {
  getSupportedResumeExtension,
  SUPPORTED_RESUME_FORMATS_LABEL,
} from "@/lib/resume-formats";
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

const WINDOWS_1252_DECODER = new TextDecoder("windows-1252");
const RTF_DESTINATION_CONTROL_WORDS = new Set([
  "fonttbl",
  "colortbl",
  "stylesheet",
  "info",
  "pict",
  "object",
  "themedata",
  "datastore",
  "xmlopen",
  "annotation",
  "header",
  "headerl",
  "headerr",
  "footer",
  "footerl",
  "footerr",
  "shppict",
  "nonshppict",
  "fldinst",
]);
const runtimeRequire = createRequire(path.join(process.cwd(), "package.json"));
const canvasPackageName = ["@napi-rs", "canvas"].join("/");

type PdfParseModule = {
  PDFParse: new (options: { data: Buffer | Uint8Array }) => {
    destroy(): Promise<void>;
    getText(): Promise<{
      text: string;
    }>;
  };
};

type CanvasModule = {
  DOMMatrix?: typeof DOMMatrix;
  ImageData?: typeof ImageData;
  Path2D?: typeof Path2D;
};

type ExtractedResumeText = {
  strategy: "pdf-parse" | "word-extractor" | "mammoth" | "docx-xml-fallback" | "rtf-parser";
  text: string;
};

type ReadableTextStats = {
  alphaCount: number;
  characterCount: number;
  lineCount: number;
  wordCount: number;
};

const MIN_RESUME_ALPHA_COUNT = 12;
const MIN_RESUME_CHARACTER_COUNT = 20;
const MIN_RESUME_WORD_COUNT = 3;

function getUnreadableResumeMessage(file: File) {
  const extension = getSupportedResumeExtension(file);
  const format = path.extname(file.name).toUpperCase().replace(".", "") || "resume";

  if (extension === ".pdf") {
    return "We couldn't extract text from that PDF. It may be scanned, image-only, or protected. Upload a text-based PDF, DOC, DOCX, or RTF resume.";
  }

  return `We couldn't read that ${format} file. Save it as a text-based ${SUPPORTED_RESUME_FORMATS_LABEL} resume and try again.`;
}

function getInsufficientResumeTextMessage(file: File) {
  const extension = getSupportedResumeExtension(file);

  if (extension === ".pdf") {
    return "We found too little selectable text in that PDF. It may be scanned or image-only. Upload a text-based PDF, DOC, DOCX, or RTF resume.";
  }

  return "We found too little readable text in that resume. Save it as a text-based DOC, DOCX, RTF, or PDF file and try again.";
}

function normalizeText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\r/g, "").trim();
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
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

function getReadableTextStats(text: string): ReadableTextStats {
  const normalized = normalizeText(text);

  return {
    alphaCount: (normalized.match(/[A-Za-z]/g) ?? []).length,
    characterCount: normalized.length,
    lineCount: splitLines(normalized).length,
    wordCount: (normalized.match(/[A-Za-z0-9][A-Za-z0-9'&/+.-]*/g) ?? []).length,
  };
}

function hasEnoughReadableText(text: string) {
  const stats = getReadableTextStats(text);

  return (
    stats.characterCount >= MIN_RESUME_CHARACTER_COUNT &&
    stats.alphaCount >= MIN_RESUME_ALPHA_COUNT &&
    stats.wordCount >= MIN_RESUME_WORD_COUNT
  );
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
  const extension = getSupportedResumeExtension(file);

  if (extension === ".pdf") {
    return "application/pdf";
  }

  if (extension === ".doc") {
    return "application/msword";
  }

  if (extension === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  if (extension === ".rtf") {
    return "application/rtf";
  }

  return "application/octet-stream";
}

function decodeRtfUnicode(value: number) {
  const normalized = value < 0 ? value + 65536 : value;
  return String.fromCharCode(normalized);
}

function ensurePdfRuntimeGlobals() {
  const canvas = runtimeRequire(canvasPackageName) as CanvasModule;

  if (!globalThis.DOMMatrix && canvas.DOMMatrix) {
    globalThis.DOMMatrix = canvas.DOMMatrix;
  }

  if (!globalThis.ImageData && canvas.ImageData) {
    globalThis.ImageData = canvas.ImageData;
  }

  if (!globalThis.Path2D && canvas.Path2D) {
    globalThis.Path2D = canvas.Path2D;
  }
}

function extractTextFromRtfDocument(source: string) {
  const output: string[] = [];
  const skipStack: boolean[] = [];
  let skipGroup = false;
  let unicodeFallbackCharsToSkip = 0;
  let unicodeSkipCount = 1;
  let index = 0;

  while (index < source.length) {
    const current = source[index];

    if (unicodeFallbackCharsToSkip > 0) {
      if (current === "\\" && source[index + 1] === "'") {
        index += 4;
      } else {
        index += 1;
      }

      unicodeFallbackCharsToSkip -= 1;
      continue;
    }

    if (current === "{") {
      skipStack.push(skipGroup);
      index += 1;
      continue;
    }

    if (current === "}") {
      skipGroup = skipStack.pop() ?? false;
      index += 1;
      continue;
    }

    if (current !== "\\") {
      if (!skipGroup) {
        output.push(current);
      }

      index += 1;
      continue;
    }

    const next = source[index + 1];

    if (!next) {
      index += 1;
      continue;
    }

    if (next === "\\" || next === "{" || next === "}") {
      if (!skipGroup) {
        output.push(next);
      }

      index += 2;
      continue;
    }

    if (next === "'") {
      const hex = source.slice(index + 2, index + 4);

      if (!skipGroup && /^[\da-fA-F]{2}$/.test(hex)) {
        output.push(WINDOWS_1252_DECODER.decode(Buffer.from(hex, "hex")));
      }

      index += 4;
      continue;
    }

    if (next === "~") {
      if (!skipGroup) {
        output.push(" ");
      }

      index += 2;
      continue;
    }

    if (next === "_" || next === "-") {
      if (!skipGroup) {
        output.push("-");
      }

      index += 2;
      continue;
    }

    if (next === "*") {
      skipGroup = true;
      index += 2;
      continue;
    }

    if (!/[A-Za-z]/.test(next)) {
      index += 2;
      continue;
    }

    let cursor = index + 1;

    while (/[A-Za-z]/.test(source[cursor] ?? "")) {
      cursor += 1;
    }

    const word = source.slice(index + 1, cursor).toLowerCase();
    let value: number | null = null;

    if (source[cursor] === "-" || /\d/.test(source[cursor] ?? "")) {
      const valueStart = cursor;
      cursor += source[cursor] === "-" ? 1 : 0;

      while (/\d/.test(source[cursor] ?? "")) {
        cursor += 1;
      }

      value = Number(source.slice(valueStart, cursor));
    }

    if (source[cursor] === " ") {
      cursor += 1;
    }

    index = cursor;

    if (RTF_DESTINATION_CONTROL_WORDS.has(word)) {
      skipGroup = true;
      continue;
    }

    if (skipGroup) {
      continue;
    }

    switch (word) {
      case "par":
      case "pard":
      case "line":
        output.push("\n");
        break;
      case "tab":
        output.push("\t");
        break;
      case "emdash":
        output.push("--");
        break;
      case "endash":
        output.push("-");
        break;
      case "bullet":
        output.push("* ");
        break;
      case "lquote":
      case "rquote":
        output.push("'");
        break;
      case "ldblquote":
      case "rdblquote":
        output.push("\"");
        break;
      case "uc":
        if (typeof value === "number" && value >= 0) {
          unicodeSkipCount = value;
        }
        break;
      case "u":
        if (typeof value === "number") {
          output.push(decodeRtfUnicode(value));
          unicodeFallbackCharsToSkip = unicodeSkipCount;
        }
        break;
      default:
        break;
    }
  }

  return normalizeText(output.join(""));
}

function extractTextFromDocxXmlDocument(xml: string) {
  const text = decodeXmlEntities(xml)
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:(?:br|cr)\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<[^>]+>/g, " ");

  return normalizeText(text);
}

async function extractTextFromDocxArchive(buffer: Buffer) {
  const JSZip = (await import("jszip")).default;
  const archive = await JSZip.loadAsync(buffer);
  const xmlEntryNames = Object.keys(archive.files).filter((name) =>
    /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/i.test(name),
  );

  if (xmlEntryNames.length === 0) {
    return "";
  }

  const xmlParts = await Promise.all(
    xmlEntryNames.map(async (name) => archive.files[name]?.async("string") ?? ""),
  );

  return extractTextFromDocxXmlDocument(xmlParts.join("\n"));
}

async function extractTextFromFile(file: File): Promise<ExtractedResumeText> {
  const extension = getSupportedResumeExtension(file);

  if (!extension) {
    throw new Error(
      `Unsupported resume format. Upload a ${SUPPORTED_RESUME_FORMATS_LABEL} file.`,
    );
  }

  const mimeType = inferMimeType(file);
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    if (mimeType === "application/pdf") {
      ensurePdfRuntimeGlobals();
      const { PDFParse } = runtimeRequire("pdf-parse") as PdfParseModule;
      const parser = new PDFParse({ data: buffer });

      try {
        const parsed = await parser.getText();
        return {
          strategy: "pdf-parse",
          text: normalizeText(parsed.text),
        };
      } finally {
        await parser.destroy();
      }
    }

    if (mimeType === "application/msword") {
      const WordExtractor = (await import("word-extractor")).default;
      const extractor = new WordExtractor();
      const document = await extractor.extract(buffer);
      return {
        strategy: "word-extractor",
        text: normalizeText(document.getBody()),
      };
    }

    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      const mammothText = normalizeText(result.value);

      if (hasEnoughReadableText(mammothText)) {
        return {
          strategy: "mammoth",
          text: mammothText,
        };
      }

      const fallbackText = await extractTextFromDocxArchive(buffer);

      return {
        strategy: hasEnoughReadableText(fallbackText) ? "docx-xml-fallback" : "mammoth",
        text: hasEnoughReadableText(fallbackText) ? fallbackText : mammothText,
      };
    }

    if (mimeType === "application/rtf") {
      return {
        strategy: "rtf-parser",
        text: extractTextFromRtfDocument(
          buffer.toString("utf8").replace(/^\ufeff/, ""),
        ),
      };
    }
  } catch (error) {
    console.error("Resume text extraction failed.", {
      error,
      fileName: file.name,
      fileSize: file.size,
      mimeType,
    });
    throw new Error(getUnreadableResumeMessage(file));
  }

  throw new Error(
    `Unsupported resume format. Upload a ${SUPPORTED_RESUME_FORMATS_LABEL} file.`,
  );
}

export async function parseUploadedResume(file: File): Promise<{
  rawText: string;
  parsed: ResumeParserResult;
  provider: AnalysisProvider;
}> {
  const extracted = await extractTextFromFile(file);
  const rawText = extracted.text.slice(0, 40000);
  const stats = getReadableTextStats(rawText);

  if (!hasEnoughReadableText(rawText)) {
    console.error("Resume text extraction produced too little readable content.", {
      alphaCount: stats.alphaCount,
      characterCount: stats.characterCount,
      fileName: file.name,
      fileSize: file.size,
      lineCount: stats.lineCount,
      mimeType: file.type || null,
      strategy: extracted.strategy,
      wordCount: stats.wordCount,
    });
    throw new Error(getInsufficientResumeTextMessage(file));
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
