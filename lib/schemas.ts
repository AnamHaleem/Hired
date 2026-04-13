import { z } from "zod";

export const CareerLaneSchema = z.enum([
  "senior_communications",
  "strategic_marketing_partnerships",
  "hybrid_review",
]);

export const JobLevelSchema = z.enum([
  "manager",
  "senior_manager",
  "director",
  "senior_director",
  "vp_plus",
  "unknown",
]);

export const JobStatusSchema = z.enum(["new", "approved", "discarded"]);

export const ScoreVerdictSchema = z.enum(["pursue", "maybe", "pass"]);

const StringListSchema = z.array(z.string().min(1)).max(12);

export const JobAnalysisSchema = z.object({
  mustHaves: StringListSchema.default([]),
  niceToHaves: StringListSchema.default([]),
  painPoints: StringListSchema.default([]),
  likelyObjections: StringListSchema.default([]),
  fitSignalKeywords: StringListSchema.default([]),
  verdict: ScoreVerdictSchema.nullable().default(null),
  bestAngle: z.string().nullable().default(null),
  gaps: StringListSchema.default([]),
  hiddenObjections: StringListSchema.default([]),
});

export const JobParserResultSchema = z.object({
  company: z.string().min(1).max(160),
  title: z.string().min(1).max(160),
  lane: CareerLaneSchema,
  level: JobLevelSchema,
  mustHaves: StringListSchema.default([]),
  niceToHaves: StringListSchema.default([]),
  painPoints: StringListSchema.default([]),
  likelyObjections: StringListSchema.default([]),
  fitSignalKeywords: StringListSchema.default([]),
});

export const CreateJobParseInputSchema = z.object({
  description: z
    .string()
    .trim()
    .min(80, "Paste a more complete job description to parse reliably.")
    .max(30000),
  source: z.string().trim().max(120).optional(),
});

export const ApproveJobInputSchema = z.object({
  jobId: z.string().uuid(),
});

export const ParserProviderSchema = z.enum(["openai", "heuristic"]);

export const StoredJobSchema = z.object({
  id: z.string().uuid(),
  source: z.string().optional(),
  company: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  lane: CareerLaneSchema,
  level: JobLevelSchema,
  fitScore: z.number().nullable(),
  status: JobStatusSchema,
  parserProvider: ParserProviderSchema.optional(),
  analysis: JobAnalysisSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CareerLane = z.infer<typeof CareerLaneSchema>;
export type JobLevel = z.infer<typeof JobLevelSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
export type ParserProvider = z.infer<typeof ParserProviderSchema>;
export type JobParserResult = z.infer<typeof JobParserResultSchema>;
export type JobAnalysis = z.infer<typeof JobAnalysisSchema>;
export type CreateJobParseInput = z.infer<typeof CreateJobParseInputSchema>;
export type ApproveJobInput = z.infer<typeof ApproveJobInputSchema>;
export type StoredJob = z.infer<typeof StoredJobSchema>;
