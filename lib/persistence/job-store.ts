import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  type JobAnalysis,
  JobAnalysisSchema,
  type JobParserResult,
  type ParserProvider,
  type StoredJob,
  StoredJobSchema,
} from "@/lib/schemas";
import {
  getDatabasePool,
  isDatabaseConfigured,
} from "@/lib/db/server";

const DATA_DIR = path.join(process.cwd(), ".data");
const JOB_STORE_FILE = path.join(DATA_DIR, "jobs.json");

type JobStore = {
  jobs: StoredJob[];
};

type CreateParsedJobArgs = {
  description: string;
  source?: string;
  parsed: JobParserResult;
  parserProvider: ParserProvider;
};

type DatabaseJobRow = {
  id: string;
  source: string | null;
  company: string | null;
  title: string | null;
  description: string;
  lane: string | null;
  level: string | null;
  fit_score: number | null;
  status: string | null;
  parser_provider: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type DatabaseAnalysisRow = {
  job_id: string;
  must_haves: unknown;
  nice_to_haves: unknown;
  pain_points: unknown;
  likely_objections: unknown;
  fit_signal_keywords: unknown;
  verdict?: unknown;
  best_angle?: unknown;
  gaps?: unknown;
  hidden_objections?: unknown;
};

type JobWithAnalysisRow = DatabaseJobRow &
  Partial<DatabaseAnalysisRow> & {
    best_angle: string | null;
    verdict: string | null;
    gaps: unknown;
    hidden_objections: unknown;
  };

const EMPTY_STORE: JobStore = {
  jobs: [],
};

function normalizeTimestamp(value: Date | string | null | undefined) {
  if (!value) {
    return new Date().toISOString();
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function mapAnalysis(row?: DatabaseAnalysisRow): JobAnalysis {
  return JobAnalysisSchema.parse({
    mustHaves: toStringList(row?.must_haves),
    niceToHaves: toStringList(row?.nice_to_haves),
    painPoints: toStringList(row?.pain_points),
    likelyObjections: toStringList(row?.likely_objections),
    fitSignalKeywords: toStringList(row?.fit_signal_keywords),
    verdict:
      row?.verdict === "pursue" || row?.verdict === "maybe" || row?.verdict === "pass"
        ? row.verdict
        : null,
    bestAngle: typeof row?.best_angle === "string" ? row.best_angle : null,
    gaps: toStringList(row?.gaps),
    hiddenObjections: toStringList(row?.hidden_objections),
  });
}

function extractAnalysisRow(row: JobWithAnalysisRow): DatabaseAnalysisRow | undefined {
  if (!row.job_id) {
    return undefined;
  }

  return {
    job_id: row.job_id,
    must_haves: row.must_haves,
    nice_to_haves: row.nice_to_haves,
    pain_points: row.pain_points,
    likely_objections: row.likely_objections,
    fit_signal_keywords: row.fit_signal_keywords,
    verdict: row.verdict,
    best_angle: row.best_angle,
    gaps: row.gaps,
    hidden_objections: row.hidden_objections,
  };
}

function mapDatabaseJob(
  job: DatabaseJobRow,
  analysis?: DatabaseAnalysisRow,
): StoredJob {
  return StoredJobSchema.parse({
    id: job.id,
    source: job.source ?? undefined,
    company: job.company ?? "Company not detected",
    title: job.title ?? "Role title not detected",
    description: job.description,
    lane:
      job.lane === "senior_communications" ||
      job.lane === "strategic_marketing_partnerships" ||
      job.lane === "hybrid_review"
        ? job.lane
        : "hybrid_review",
    level:
      job.level === "manager" ||
      job.level === "senior_manager" ||
      job.level === "director" ||
      job.level === "senior_director" ||
      job.level === "vp_plus" ||
      job.level === "unknown"
        ? job.level
        : "unknown",
    fitScore: job.fit_score,
    status:
      job.status === "new" || job.status === "approved" || job.status === "discarded"
        ? job.status
        : "new",
    parserProvider:
      job.parser_provider === "openai" || job.parser_provider === "heuristic"
        ? job.parser_provider
        : undefined,
    analysis: mapAnalysis(analysis),
    createdAt: normalizeTimestamp(job.created_at),
    updatedAt: normalizeTimestamp(job.updated_at),
  });
}

function buildStoredJob(args: CreateParsedJobArgs): StoredJob {
  const now = new Date().toISOString();

  return StoredJobSchema.parse({
    id: randomUUID(),
    source: args.source,
    company: args.parsed.company,
    title: args.parsed.title,
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
      gaps: [],
      hiddenObjections: [],
    },
    createdAt: now,
    updatedAt: now,
  });
}

async function readLocalStore() {
  try {
    const raw = await fs.readFile(JOB_STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as JobStore;

    return {
      jobs: parsed.jobs.map((job) => StoredJobSchema.parse(job)),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return EMPTY_STORE;
    }

    throw error;
  }
}

async function writeLocalStore(store: JobStore) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(JOB_STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

async function createParsedJobLocal(args: CreateParsedJobArgs) {
  const store = await readLocalStore();
  const job = buildStoredJob(args);

  store.jobs.unshift(job);
  await writeLocalStore(store);

  return job;
}

async function listJobsLocal() {
  const store = await readLocalStore();

  return [...store.jobs].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

async function getJobByIdLocal(jobId: string) {
  const jobs = await listJobsLocal();
  return jobs.find((job) => job.id === jobId) ?? null;
}

async function approveJobLocal(jobId: string) {
  const store = await readLocalStore();
  const index = store.jobs.findIndex((job) => job.id === jobId);

  if (index === -1) {
    return null;
  }

  const current = store.jobs[index];
  const updated = StoredJobSchema.parse({
    ...current,
    status: "approved",
    updatedAt: new Date().toISOString(),
  });

  store.jobs[index] = updated;
  await writeLocalStore(store);

  return updated;
}

async function createParsedJobDatabase(args: CreateParsedJobArgs) {
  const pool = getDatabasePool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const jobResult = await client.query<DatabaseJobRow>(
      `
        insert into jobs (
          source,
          company,
          title,
          description,
          lane,
          level,
          status,
          parser_provider
        )
        values ($1, $2, $3, $4, $5, $6, 'new', $7)
        returning
          id,
          source,
          company,
          title,
          description,
          lane,
          level,
          fit_score,
          status,
          parser_provider,
          created_at,
          updated_at
      `,
      [
        args.source ?? null,
        args.parsed.company,
        args.parsed.title,
        args.description,
        args.parsed.lane,
        args.parsed.level,
        args.parserProvider,
      ],
    );

    const analysisResult = await client.query<DatabaseAnalysisRow>(
      `
        insert into job_analyses (
          job_id,
          must_haves,
          nice_to_haves,
          pain_points,
          likely_objections,
          fit_signal_keywords
        )
        values ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb)
        returning
          job_id,
          must_haves,
          nice_to_haves,
          pain_points,
          likely_objections,
          fit_signal_keywords,
          verdict,
          best_angle,
          gaps,
          hidden_objections
      `,
      [
        jobResult.rows[0].id,
        JSON.stringify(args.parsed.mustHaves),
        JSON.stringify(args.parsed.niceToHaves),
        JSON.stringify(args.parsed.painPoints),
        JSON.stringify(args.parsed.likelyObjections),
        JSON.stringify(args.parsed.fitSignalKeywords),
      ],
    );

    await client.query("commit");

    return mapDatabaseJob(jobResult.rows[0], analysisResult.rows[0]);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function listJobsDatabase() {
  const pool = getDatabasePool();
  const result = await pool.query<JobWithAnalysisRow>(`
    select
      j.id,
      j.source,
      j.company,
      j.title,
      j.description,
      j.lane,
      j.level,
      j.fit_score,
      j.status,
      j.parser_provider,
      j.created_at,
      j.updated_at,
      a.job_id,
      a.must_haves,
      a.nice_to_haves,
      a.pain_points,
      a.likely_objections,
      a.fit_signal_keywords,
      a.verdict,
      a.best_angle,
      a.gaps,
      a.hidden_objections
    from jobs j
    left join lateral (
      select
        job_id,
        must_haves,
        nice_to_haves,
        pain_points,
        likely_objections,
        fit_signal_keywords,
        verdict,
        best_angle,
        gaps,
        hidden_objections
      from job_analyses
      where job_id = j.id
      order by created_at desc
      limit 1
    ) a on true
    order by j.created_at desc
  `);

  return result.rows.map((row) => mapDatabaseJob(row, extractAnalysisRow(row)));
}

async function getJobByIdDatabase(jobId: string) {
  const pool = getDatabasePool();
  const result = await pool.query<JobWithAnalysisRow>(
    `
      select
        j.id,
        j.source,
        j.company,
        j.title,
        j.description,
        j.lane,
        j.level,
        j.fit_score,
        j.status,
        j.parser_provider,
        j.created_at,
        j.updated_at,
        a.job_id,
        a.must_haves,
        a.nice_to_haves,
        a.pain_points,
        a.likely_objections,
        a.fit_signal_keywords,
        a.verdict,
        a.best_angle,
        a.gaps,
        a.hidden_objections
      from jobs j
      left join lateral (
        select
          job_id,
          must_haves,
          nice_to_haves,
          pain_points,
          likely_objections,
          fit_signal_keywords,
          verdict,
          best_angle,
          gaps,
          hidden_objections
        from job_analyses
        where job_id = j.id
        order by created_at desc
        limit 1
      ) a on true
      where j.id = $1
    `,
    [jobId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return mapDatabaseJob(row, extractAnalysisRow(row));
}

async function approveJobDatabase(jobId: string) {
  const pool = getDatabasePool();
  await pool.query(
    `
      update jobs
      set status = 'approved',
          updated_at = now()
      where id = $1
    `,
    [jobId],
  );

  return getJobByIdDatabase(jobId);
}

export async function createParsedJob(args: CreateParsedJobArgs) {
  if (isDatabaseConfigured()) {
    return createParsedJobDatabase(args);
  }

  return createParsedJobLocal(args);
}

export async function listJobs() {
  if (isDatabaseConfigured()) {
    return listJobsDatabase();
  }

  return listJobsLocal();
}

export async function getJobById(jobId: string) {
  if (isDatabaseConfigured()) {
    return getJobByIdDatabase(jobId);
  }

  return getJobByIdLocal(jobId);
}

export async function approveJob(jobId: string) {
  if (isDatabaseConfigured()) {
    return approveJobDatabase(jobId);
  }

  return approveJobLocal(jobId);
}
