import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { getDatabasePool, isDatabaseConfigured } from "@/lib/db/server";
import {
  type CreateAchievementInput,
  type StoredAchievement,
  StoredAchievementSchema,
  type StoredProfile,
  StoredProfileSchema,
  type UpsertProfileInput,
} from "@/lib/schemas";

const DATA_DIR = path.join(process.cwd(), ".data");
const VAULT_STORE_FILE = path.join(DATA_DIR, "vault.json");

type VaultStore = {
  profile: StoredProfile | null;
  achievements: StoredAchievement[];
};

type DatabaseProfileRow = {
  id: string;
  name: string;
  target_region: string | null;
  years_experience: number | null;
  master_summary: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type DatabaseAchievementRow = {
  id: string;
  profile_id: string;
  company: string | null;
  role_title: string | null;
  lane: string | null;
  industry: string | null;
  situation: string;
  action: string;
  result: string;
  metrics: unknown;
  tags: unknown;
  raw_text: string;
  created_at: Date | string;
  updated_at: Date | string;
};

const EMPTY_STORE: VaultStore = {
  profile: null,
  achievements: [],
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
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }

  return [];
}

function buildRawText(input: CreateAchievementInput) {
  const blocks = [
    input.company,
    input.roleTitle,
    input.industry,
    input.situation,
    input.action,
    input.result,
    ...input.metrics,
    ...input.tags,
  ]
    .filter((item): item is string => Boolean(item && item.trim()))
    .map((item) => item.trim());

  return input.rawText?.trim() || blocks.join(" | ");
}

function mapProfile(row: DatabaseProfileRow): StoredProfile {
  return StoredProfileSchema.parse({
    id: row.id,
    name: row.name,
    targetRegion: normalizeOptionalText(row.target_region),
    yearsExperience: row.years_experience ?? null,
    masterSummary: row.master_summary,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  });
}

function mapAchievement(row: DatabaseAchievementRow): StoredAchievement {
  return StoredAchievementSchema.parse({
    id: row.id,
    profileId: row.profile_id,
    company: normalizeOptionalText(row.company),
    roleTitle: normalizeOptionalText(row.role_title),
    lane:
      row.lane === "senior_communications" ||
      row.lane === "strategic_marketing_partnerships" ||
      row.lane === "hybrid_review"
        ? row.lane
        : null,
    industry: normalizeOptionalText(row.industry),
    situation: row.situation,
    action: row.action,
    result: row.result,
    metrics: toStringList(row.metrics),
    tags: toStringList(row.tags),
    rawText: row.raw_text,
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
  });
}

async function readLocalStore() {
  try {
    const raw = await fs.readFile(VAULT_STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as VaultStore;

    return {
      profile: parsed.profile ? StoredProfileSchema.parse(parsed.profile) : null,
      achievements: parsed.achievements.map((achievement) =>
        StoredAchievementSchema.parse(achievement),
      ),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return EMPTY_STORE;
    }

    throw error;
  }
}

async function writeLocalStore(store: VaultStore) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(VAULT_STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

async function getProfileLocal() {
  const store = await readLocalStore();
  return store.profile;
}

async function upsertProfileLocal(input: UpsertProfileInput) {
  const store = await readLocalStore();
  const now = new Date().toISOString();

  const profile = StoredProfileSchema.parse({
    id: store.profile?.id ?? randomUUID(),
    name: input.name.trim(),
    targetRegion: normalizeOptionalText(input.targetRegion),
    yearsExperience: input.yearsExperience ?? null,
    masterSummary: input.masterSummary.trim(),
    createdAt: store.profile?.createdAt ?? now,
    updatedAt: now,
  });

  store.profile = profile;
  await writeLocalStore(store);
  return profile;
}

async function listAchievementsLocal() {
  const store = await readLocalStore();
  return [...store.achievements].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

async function createAchievementLocal(input: CreateAchievementInput) {
  const store = await readLocalStore();

  if (!store.profile) {
    throw new Error("Create a profile before adding achievements.");
  }

  const now = new Date().toISOString();
  const achievement = StoredAchievementSchema.parse({
    id: randomUUID(),
    profileId: store.profile.id,
    company: normalizeOptionalText(input.company),
    roleTitle: normalizeOptionalText(input.roleTitle),
    lane: input.lane ?? null,
    industry: normalizeOptionalText(input.industry),
    situation: input.situation.trim(),
    action: input.action.trim(),
    result: input.result.trim(),
    metrics: input.metrics,
    tags: input.tags,
    rawText: buildRawText(input),
    createdAt: now,
    updatedAt: now,
  });

  store.achievements.unshift(achievement);
  await writeLocalStore(store);
  return achievement;
}

async function getProfileDatabase() {
  const pool = getDatabasePool();
  const result = await pool.query<DatabaseProfileRow>(`
    select
      id,
      name,
      target_region,
      years_experience,
      master_summary,
      created_at,
      updated_at
    from profiles
    order by created_at asc
    limit 1
  `);

  const row = result.rows[0];
  return row ? mapProfile(row) : null;
}

async function upsertProfileDatabase(input: UpsertProfileInput) {
  const pool = getDatabasePool();
  const existing = await getProfileDatabase();

  if (existing) {
    const result = await pool.query<DatabaseProfileRow>(
      `
        update profiles
        set name = $2,
            target_region = $3,
            years_experience = $4,
            master_summary = $5,
            updated_at = now()
        where id = $1
        returning
          id,
          name,
          target_region,
          years_experience,
          master_summary,
          created_at,
          updated_at
      `,
      [
        existing.id,
        input.name.trim(),
        normalizeOptionalText(input.targetRegion),
        input.yearsExperience ?? null,
        input.masterSummary.trim(),
      ],
    );

    return mapProfile(result.rows[0]);
  }

  const result = await pool.query<DatabaseProfileRow>(
    `
      insert into profiles (
        name,
        target_region,
        years_experience,
        master_summary
      )
      values ($1, $2, $3, $4)
      returning
        id,
        name,
        target_region,
        years_experience,
        master_summary,
        created_at,
        updated_at
    `,
    [
      input.name.trim(),
      normalizeOptionalText(input.targetRegion),
      input.yearsExperience ?? null,
      input.masterSummary.trim(),
    ],
  );

  return mapProfile(result.rows[0]);
}

async function listAchievementsDatabase() {
  const pool = getDatabasePool();
  const result = await pool.query<DatabaseAchievementRow>(`
    select
      id,
      profile_id,
      company,
      role_title,
      lane,
      industry,
      situation,
      action,
      result,
      metrics,
      tags,
      raw_text,
      created_at,
      updated_at
    from achievements
    order by created_at desc
  `);

  return result.rows.map((row) => mapAchievement(row));
}

async function createAchievementDatabase(input: CreateAchievementInput) {
  const pool = getDatabasePool();
  const profile = await getProfileDatabase();

  if (!profile) {
    throw new Error("Create a profile before adding achievements.");
  }

  const result = await pool.query<DatabaseAchievementRow>(
    `
      insert into achievements (
        profile_id,
        company,
        role_title,
        lane,
        industry,
        situation,
        action,
        result,
        metrics,
        tags,
        raw_text
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::text[], $11)
      returning
        id,
        profile_id,
        company,
        role_title,
        lane,
        industry,
        situation,
        action,
        result,
        metrics,
        tags,
        raw_text,
        created_at,
        updated_at
    `,
    [
      profile.id,
      normalizeOptionalText(input.company),
      normalizeOptionalText(input.roleTitle),
      input.lane ?? null,
      normalizeOptionalText(input.industry),
      input.situation.trim(),
      input.action.trim(),
      input.result.trim(),
      JSON.stringify(input.metrics),
      input.tags,
      buildRawText(input),
    ],
  );

  return mapAchievement(result.rows[0]);
}

export async function getProfile() {
  if (isDatabaseConfigured()) {
    return getProfileDatabase();
  }

  return getProfileLocal();
}

export async function upsertProfile(input: UpsertProfileInput) {
  if (isDatabaseConfigured()) {
    return upsertProfileDatabase(input);
  }

  return upsertProfileLocal(input);
}

export async function listAchievements() {
  if (isDatabaseConfigured()) {
    return listAchievementsDatabase();
  }

  return listAchievementsLocal();
}

export async function createAchievement(input: CreateAchievementInput) {
  if (isDatabaseConfigured()) {
    return createAchievementDatabase(input);
  }

  return createAchievementLocal(input);
}
