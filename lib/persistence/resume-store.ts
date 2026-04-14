import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { getDatabasePool, isDatabaseConfigured } from "@/lib/db/server";
import {
  type ResumeParserResult,
  type StoredResume,
  StoredResumeSchema,
} from "@/lib/schemas";
import { getProfile } from "@/lib/persistence/profile-store";

const DATA_DIR = path.join(process.cwd(), ".data");
const RESUME_STORE_FILE = path.join(DATA_DIR, "resumes.json");

type ResumeStore = {
  resumes: StoredResume[];
};

type CreateParsedResumeArgs = {
  label: string;
  originalFilename: string;
  mimeType: string;
  rawText: string;
  parsed: ResumeParserResult;
  makeActive?: boolean;
};

type DatabaseResumeRow = {
  id: string;
  label: string;
  original_filename: string;
  mime_type: string;
  parsed_name: string | null;
  headline: string | null;
  lane: string | null;
  years_experience: number | null;
  summary: string;
  core_skills: unknown;
  focus_areas: unknown;
  highlight_bullets: unknown;
  raw_text: string;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

const EMPTY_STORE: ResumeStore = {
  resumes: [],
};

function normalizeTimestamp(value: Date | string | null | undefined) {
  if (!value) {
    return new Date().toISOString();
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizeOptionalText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function buildStoredResume(
  args: CreateParsedResumeArgs,
  overrides?: Partial<StoredResume>,
) {
  const now = new Date().toISOString();

  return StoredResumeSchema.parse({
    id: randomUUID(),
    label: args.label.trim(),
    originalFilename: args.originalFilename,
    mimeType: args.mimeType,
    parsedName: args.parsed.parsedName,
    headline: args.parsed.headline,
    lane: args.parsed.lane,
    yearsExperience: args.parsed.yearsExperience,
    summary: args.parsed.summary,
    coreSkills: args.parsed.coreSkills,
    focusAreas: args.parsed.focusAreas,
    highlightBullets: args.parsed.highlightBullets,
    rawText: args.rawText,
    isActive: args.makeActive ?? true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

function mapResume(row: DatabaseResumeRow): StoredResume {
  return StoredResumeSchema.parse({
    id: row.id,
    label: row.label,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    parsedName: normalizeOptionalText(row.parsed_name),
    headline: normalizeOptionalText(row.headline),
    lane:
      row.lane === "senior_communications" ||
      row.lane === "strategic_marketing_partnerships" ||
      row.lane === "hybrid_review"
        ? row.lane
        : null,
    yearsExperience: row.years_experience ?? null,
    summary: row.summary,
    coreSkills: toStringList(row.core_skills),
    focusAreas: toStringList(row.focus_areas),
    highlightBullets: toStringList(row.highlight_bullets),
    rawText: row.raw_text,
    isActive: row.is_active,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  });
}

async function readLocalStore() {
  try {
    const raw = await fs.readFile(RESUME_STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as ResumeStore;

    return {
      resumes: (parsed.resumes ?? []).map((resume) => StoredResumeSchema.parse(resume)),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return EMPTY_STORE;
    }

    throw error;
  }
}

async function writeLocalStore(store: ResumeStore) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(RESUME_STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

async function listResumesLocal() {
  const store = await readLocalStore();
  return [...store.resumes].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

async function getActiveResumeLocal() {
  const resumes = await listResumesLocal();
  return resumes.find((resume) => resume.isActive) ?? null;
}

async function getResumeByIdLocal(resumeId: string) {
  const resumes = await listResumesLocal();
  return resumes.find((resume) => resume.id === resumeId) ?? null;
}

async function createParsedResumeLocal(args: CreateParsedResumeArgs) {
  const store = await readLocalStore();
  const shouldMakeActive = args.makeActive ?? true;

  const resumes = store.resumes.map((resume) =>
    shouldMakeActive
      ? StoredResumeSchema.parse({
          ...resume,
          isActive: false,
          updatedAt: new Date().toISOString(),
        })
      : resume,
  );

  const resume = buildStoredResume(args, {
    isActive: store.resumes.length === 0 ? true : shouldMakeActive,
  });

  resumes.unshift(resume);
  await writeLocalStore({ resumes });
  return resume;
}

async function setActiveResumeLocal(resumeId: string) {
  const store = await readLocalStore();
  let nextActive: StoredResume | null = null;

  const resumes = store.resumes.map((resume) => {
    const isActive = resume.id === resumeId;
    const updated = StoredResumeSchema.parse({
      ...resume,
      isActive,
      updatedAt: isActive ? new Date().toISOString() : resume.updatedAt,
    });

    if (isActive) {
      nextActive = updated;
    }

    return updated;
  });

  await writeLocalStore({ resumes });
  return nextActive;
}

async function listResumesDatabase() {
  const pool = getDatabasePool();
  const result = await pool.query<DatabaseResumeRow>(`
    select
      id,
      label,
      original_filename,
      mime_type,
      parsed_name,
      headline,
      lane,
      years_experience,
      summary,
      core_skills,
      focus_areas,
      highlight_bullets,
      raw_text,
      is_active,
      created_at,
      updated_at
    from resumes
    order by created_at desc
  `);

  return result.rows.map((row) => mapResume(row));
}

async function getActiveResumeDatabase() {
  const pool = getDatabasePool();
  const result = await pool.query<DatabaseResumeRow>(`
    select
      id,
      label,
      original_filename,
      mime_type,
      parsed_name,
      headline,
      lane,
      years_experience,
      summary,
      core_skills,
      focus_areas,
      highlight_bullets,
      raw_text,
      is_active,
      created_at,
      updated_at
    from resumes
    where is_active = true
    order by updated_at desc
    limit 1
  `);

  const row = result.rows[0];
  return row ? mapResume(row) : null;
}

async function getResumeByIdDatabase(resumeId: string) {
  const pool = getDatabasePool();
  const result = await pool.query<DatabaseResumeRow>(
    `
      select
        id,
        label,
        original_filename,
        mime_type,
        parsed_name,
        headline,
        lane,
        years_experience,
        summary,
        core_skills,
        focus_areas,
        highlight_bullets,
        raw_text,
        is_active,
        created_at,
        updated_at
      from resumes
      where id = $1
    `,
    [resumeId],
  );

  const row = result.rows[0];
  return row ? mapResume(row) : null;
}

async function createParsedResumeDatabase(args: CreateParsedResumeArgs) {
  const pool = getDatabasePool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const shouldMakeActive = args.makeActive ?? true;

    if (shouldMakeActive) {
      await client.query(
        `
          update resumes
          set is_active = false,
              updated_at = now()
          where is_active = true
        `,
      );
    }

    const profile = await getProfile();

    const result = await client.query<DatabaseResumeRow>(
      `
        insert into resumes (
          profile_id,
          label,
          original_filename,
          mime_type,
          parsed_name,
          headline,
          lane,
          years_experience,
          summary,
          core_skills,
          focus_areas,
          highlight_bullets,
          raw_text,
          is_active
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13, $14)
        returning
          id,
          label,
          original_filename,
          mime_type,
          parsed_name,
          headline,
          lane,
          years_experience,
          summary,
          core_skills,
          focus_areas,
          highlight_bullets,
          raw_text,
          is_active,
          created_at,
          updated_at
      `,
      [
        profile?.id ?? null,
        args.label.trim(),
        args.originalFilename,
        args.mimeType,
        args.parsed.parsedName,
        args.parsed.headline,
        args.parsed.lane,
        args.parsed.yearsExperience,
        args.parsed.summary,
        JSON.stringify(args.parsed.coreSkills),
        JSON.stringify(args.parsed.focusAreas),
        JSON.stringify(args.parsed.highlightBullets),
        args.rawText,
        shouldMakeActive,
      ],
    );

    await client.query("commit");
    return mapResume(result.rows[0]);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function setActiveResumeDatabase(resumeId: string) {
  const pool = getDatabasePool();
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query(
      `
        update resumes
        set is_active = false,
            updated_at = now()
        where is_active = true
      `,
    );

    await client.query(
      `
        update resumes
        set is_active = true,
            updated_at = now()
        where id = $1
      `,
      [resumeId],
    );

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return getResumeByIdDatabase(resumeId);
}

export async function listResumes() {
  if (isDatabaseConfigured()) {
    return listResumesDatabase();
  }

  return listResumesLocal();
}

export async function getActiveResume() {
  if (isDatabaseConfigured()) {
    return getActiveResumeDatabase();
  }

  return getActiveResumeLocal();
}

export async function getResumeById(resumeId: string) {
  if (isDatabaseConfigured()) {
    return getResumeByIdDatabase(resumeId);
  }

  return getResumeByIdLocal(resumeId);
}

export async function createParsedResume(args: CreateParsedResumeArgs) {
  if (isDatabaseConfigured()) {
    return createParsedResumeDatabase(args);
  }

  return createParsedResumeLocal(args);
}

export async function setActiveResume(resumeId: string) {
  if (isDatabaseConfigured()) {
    return setActiveResumeDatabase(resumeId);
  }

  return setActiveResumeLocal(resumeId);
}
