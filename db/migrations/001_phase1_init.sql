create extension if not exists pgcrypto;

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  source text,
  company text,
  title text,
  description text not null,
  location text,
  lane text not null,
  level text not null,
  fit_score numeric,
  status text not null default 'new',
  parser_provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_created_at_idx on jobs (created_at desc);
create index if not exists jobs_status_idx on jobs (status);

create table if not exists job_analyses (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  must_haves jsonb not null default '[]'::jsonb,
  nice_to_haves jsonb not null default '[]'::jsonb,
  pain_points jsonb not null default '[]'::jsonb,
  likely_objections jsonb not null default '[]'::jsonb,
  fit_signal_keywords jsonb not null default '[]'::jsonb,
  verdict text,
  best_angle text,
  gaps jsonb not null default '[]'::jsonb,
  hidden_objections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists job_analyses_job_id_idx on job_analyses (job_id, created_at desc);
