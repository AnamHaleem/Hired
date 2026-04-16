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

export const AnalysisProviderSchema = z.enum(["openai", "heuristic"]);
export const ParserProviderSchema = AnalysisProviderSchema;

export const StoredProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  targetRegion: z.string().max(120).nullable().default(null),
  yearsExperience: z.number().int().min(0).max(50).nullable().default(null),
  masterSummary: z.string().min(1).max(5000),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const UpsertProfileInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  targetRegion: z.string().trim().max(120).optional(),
  yearsExperience: z.number().int().min(0).max(50).nullable().optional(),
  masterSummary: z.string().trim().min(1).max(5000),
});

export const StoredAchievementSchema = z.object({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  company: z.string().nullable().default(null),
  roleTitle: z.string().nullable().default(null),
  lane: CareerLaneSchema.nullable().default(null),
  industry: z.string().nullable().default(null),
  situation: z.string().min(1).max(1200),
  action: z.string().min(1).max(1200),
  result: z.string().min(1).max(1200),
  metrics: StringListSchema.default([]),
  tags: StringListSchema.default([]),
  rawText: z.string().min(1).max(4000),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateAchievementInputSchema = z.object({
  company: z.string().trim().max(160).optional(),
  roleTitle: z.string().trim().max(160).optional(),
  lane: CareerLaneSchema.nullable().optional(),
  industry: z.string().trim().max(120).optional(),
  situation: z.string().trim().min(12).max(1200),
  action: z.string().trim().min(12).max(1200),
  result: z.string().trim().min(12).max(1200),
  metrics: StringListSchema.default([]),
  tags: StringListSchema.default([]),
  rawText: z.string().trim().max(4000).optional(),
});

export const ParseAchievementInputSchema = z.object({
  company: z.string().trim().max(160).optional(),
  roleTitle: z.string().trim().max(160).optional(),
  lane: CareerLaneSchema.nullable().optional(),
  industry: z.string().trim().max(120).optional(),
  roleContext: z.string().trim().max(6000).optional(),
});

export const ParseAchievementResultSchema = z.object({
  achievements: z.array(CreateAchievementInputSchema).min(1).max(6),
});

export const ResumeParserResultSchema = z.object({
  parsedName: z.string().nullable().default(null),
  headline: z.string().nullable().default(null),
  lane: CareerLaneSchema.nullable().default(null),
  yearsExperience: z.number().int().min(0).max(50).nullable().default(null),
  summary: z.string().min(1).max(2400),
  coreSkills: StringListSchema.default([]),
  focusAreas: StringListSchema.default([]),
  highlightBullets: StringListSchema.default([]),
});

export const StoredResumeSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(160),
  originalFilename: z.string().min(1).max(260),
  mimeType: z.string().min(1).max(120),
  parsedName: z.string().nullable().default(null),
  headline: z.string().nullable().default(null),
  lane: CareerLaneSchema.nullable().default(null),
  yearsExperience: z.number().int().min(0).max(50).nullable().default(null),
  summary: z.string().min(1).max(2400),
  coreSkills: StringListSchema.default([]),
  focusAreas: StringListSchema.default([]),
  highlightBullets: StringListSchema.default([]),
  rawText: z.string().min(1).max(40000),
  isActive: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const SetActiveResumeInputSchema = z.object({
  resumeId: z.string().uuid(),
});

export const RetrievedAchievementSchema = z.object({
  id: z.string().uuid(),
  company: z.string().nullable().default(null),
  roleTitle: z.string().nullable().default(null),
  lane: CareerLaneSchema.nullable().default(null),
  score: z.number().int().min(0).max(100),
  summary: z.string().min(1).max(320),
  evidence: StringListSchema.default([]),
  metrics: StringListSchema.default([]),
  tags: StringListSchema.default([]),
});

export const JobAnalysisSchema = z.object({
  mustHaves: StringListSchema.default([]),
  niceToHaves: StringListSchema.default([]),
  painPoints: StringListSchema.default([]),
  likelyObjections: StringListSchema.default([]),
  fitSignalKeywords: StringListSchema.default([]),
  verdict: ScoreVerdictSchema.nullable().default(null),
  bestAngle: z.string().nullable().default(null),
  topProofPoints: StringListSchema.default([]),
  gaps: StringListSchema.default([]),
  hiddenObjections: StringListSchema.default([]),
  resumeId: z.string().uuid().nullable().default(null),
  resumeName: z.string().nullable().default(null),
  resumeHighlights: StringListSchema.default([]),
  retrievedAchievements: z.array(RetrievedAchievementSchema).max(10).default([]),
  scoringProvider: AnalysisProviderSchema.nullable().default(null),
  scoringModel: z.string().nullable().default(null),
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

export const ScoreJobInputSchema = z.object({
  jobId: z.string().uuid(),
  resumeId: z.string().uuid().optional(),
});

export const JobScoreResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  verdict: ScoreVerdictSchema,
  bestAngle: z.string().min(1).max(240),
  topProofPoints: StringListSchema.default([]),
  gaps: StringListSchema.default([]),
  hiddenObjections: StringListSchema.default([]),
  resumeHighlights: StringListSchema.default([]),
  retrievedAchievements: z.array(RetrievedAchievementSchema).max(10).default([]),
});

export const LocationSweepInputSchema = z.object({
  location: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return undefined;
      }

      const normalized = value.trim();
      return normalized.length > 0 ? normalized : undefined;
    },
    z.string().min(2).max(160).optional(),
  ),
  minScore: z.preprocess(
    (value) => {
      if (value === null || value === undefined || value === "") {
        return 89;
      }

      if (typeof value === "number") {
        return Number.isFinite(value) ? value : 89;
      }

      if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 89;
      }

      return value;
    },
    z.number().int().min(60).max(95),
  ),
});

export const SweptRoleMatchSchema = z.object({
  externalId: z.string().min(1).max(160),
  source: z.string().min(1).max(120),
  searchQuery: z.string().min(1).max(160),
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  location: z.string().min(1).max(200),
  redirectUrl: z.string().url(),
  description: z.string().min(1).max(4000),
  lane: CareerLaneSchema,
  level: JobLevelSchema,
  score: z.number().int().min(0).max(100),
  verdict: ScoreVerdictSchema,
  bestAngle: z.string().min(1).max(240),
  topProofPoints: StringListSchema.default([]),
  gaps: StringListSchema.default([]),
  hiddenObjections: StringListSchema.default([]),
  resumeHighlights: StringListSchema.default([]),
  matchReasons: StringListSchema.default([]),
  resumeRecommendations: StringListSchema.default([]),
  salaryMin: z.number().nullable().default(null),
  salaryMax: z.number().nullable().default(null),
  createdAt: z.string().nullable().default(null),
  parserProvider: ParserProviderSchema,
  scoringProvider: AnalysisProviderSchema,
  scoringModel: z.string().nullable().default(null),
});

export const LocationSweepResultSchema = z.object({
  location: z.string().min(1).max(160),
  minScore: z.number().int().min(60).max(95),
  queries: StringListSchema,
  matches: z.array(SweptRoleMatchSchema).max(30),
});

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
export type ScoreVerdict = z.infer<typeof ScoreVerdictSchema>;
export type AnalysisProvider = z.infer<typeof AnalysisProviderSchema>;
export type ParserProvider = z.infer<typeof AnalysisProviderSchema>;
export type JobParserResult = z.infer<typeof JobParserResultSchema>;
export type JobAnalysis = z.infer<typeof JobAnalysisSchema>;
export type CreateJobParseInput = z.infer<typeof CreateJobParseInputSchema>;
export type ApproveJobInput = z.infer<typeof ApproveJobInputSchema>;
export type ScoreJobInput = z.infer<typeof ScoreJobInputSchema>;
export type JobScoreResult = z.infer<typeof JobScoreResultSchema>;
export type LocationSweepInput = z.infer<typeof LocationSweepInputSchema>;
export type SweptRoleMatch = z.infer<typeof SweptRoleMatchSchema>;
export type LocationSweepResult = z.infer<typeof LocationSweepResultSchema>;
export type StoredJob = z.infer<typeof StoredJobSchema>;
export type StoredProfile = z.infer<typeof StoredProfileSchema>;
export type UpsertProfileInput = z.infer<typeof UpsertProfileInputSchema>;
export type StoredAchievement = z.infer<typeof StoredAchievementSchema>;
export type CreateAchievementInput = z.infer<typeof CreateAchievementInputSchema>;
export type ParseAchievementInput = z.infer<typeof ParseAchievementInputSchema>;
export type ParseAchievementResult = z.infer<typeof ParseAchievementResultSchema>;
export type ResumeParserResult = z.infer<typeof ResumeParserResultSchema>;
export type StoredResume = z.infer<typeof StoredResumeSchema>;
export type SetActiveResumeInput = z.infer<typeof SetActiveResumeInputSchema>;
export type RetrievedAchievement = z.infer<typeof RetrievedAchievementSchema>;
