create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target_region text,
  years_experience integer,
  master_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists career_lanes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  slug text not null unique,
  name text not null,
  positioning text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists career_lanes_profile_id_idx on career_lanes (profile_id);

create table if not exists achievements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  company text,
  role_title text,
  lane text,
  industry text,
  situation text,
  action text,
  result text,
  metrics jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  raw_text text not null,
  embedding_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists achievements_profile_id_idx on achievements (profile_id);
create index if not exists achievements_lane_idx on achievements (lane);

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  lane_id uuid references career_lanes(id) on delete set null,
  submitted_at timestamptz,
  outcome text,
  stage text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_job_lane_unique unique (job_id, lane_id)
);

create index if not exists applications_job_id_idx on applications (job_id);
create index if not exists applications_stage_idx on applications (stage);

create table if not exists generated_assets (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  asset_type text not null,
  content text not null,
  version_no integer not null default 1,
  is_final boolean not null default false,
  prompt_version text,
  model_name text,
  created_at timestamptz not null default now()
);

create index if not exists generated_assets_application_id_idx on generated_assets (application_id, asset_type);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  company text,
  title text,
  linkedin_url text,
  relationship_strength integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  application_id uuid references applications(id) on delete set null,
  interaction_type text,
  content text,
  happened_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists interactions_contact_id_idx on interactions (contact_id, happened_at desc);
create index if not exists interactions_application_id_idx on interactions (application_id, happened_at desc);

create table if not exists weekly_insights (
  id uuid primary key default gen_random_uuid(),
  summary text not null,
  strongest_lane text,
  bottleneck_stage text,
  recommendations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
