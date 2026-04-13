create extension if not exists vector;

create table profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target_region text,
  years_experience int,
  master_summary text,
  created_at timestamptz default now()
);

create table career_lanes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  name text not null,
  positioning text not null,
  is_primary boolean default false,
  created_at timestamptz default now()
);

create table achievements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  company text,
  role_title text,
  lane text,
  industry text,
  situation text,
  action text,
  result text,
  metrics jsonb,
  tags text[],
  raw_text text not null,
  embedding vector(384),
  created_at timestamptz default now()
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  source text,
  company text,
  title text,
  description text not null,
  location text,
  lane text,
  level text,
  fit_score numeric,
  status text default 'new',
  created_at timestamptz default now()
);

create table job_analyses (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  must_haves jsonb,
  nice_to_haves jsonb,
  pain_points jsonb,
  likely_objections jsonb,
  fit_signal_keywords jsonb,
  verdict text,
  best_angle text,
  gaps jsonb,
  hidden_objections jsonb,
  created_at timestamptz default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  lane_id uuid references career_lanes(id),
  submitted_at timestamptz,
  outcome text,
  stage text,
  notes text,
  created_at timestamptz default now()
);

create table generated_assets (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade,
  asset_type text not null,
  content text not null,
  version_no int not null default 1,
  is_final boolean default false,
  created_at timestamptz default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  company text,
  title text,
  linkedin_url text,
  relationship_strength int default 0,
  notes text,
  created_at timestamptz default now()
);

create table interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  application_id uuid references applications(id) on delete set null,
  interaction_type text,
  content text,
  happened_at timestamptz default now()
);

create table weekly_insights (
  id uuid primary key default gen_random_uuid(),
  summary text not null,
  strongest_lane text,
  bottleneck_stage text,
  recommendations jsonb,
  created_at timestamptz default now()
);
