create table if not exists resumes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  label text not null,
  original_filename text not null,
  mime_type text not null,
  parsed_name text,
  headline text,
  lane text,
  years_experience integer,
  summary text not null,
  core_skills jsonb not null default '[]'::jsonb,
  focus_areas jsonb not null default '[]'::jsonb,
  highlight_bullets jsonb not null default '[]'::jsonb,
  raw_text text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resumes_created_at_idx on resumes (created_at desc);
create index if not exists resumes_lane_idx on resumes (lane);
create unique index if not exists resumes_single_active_idx on resumes ((is_active)) where is_active = true;

alter table job_analyses
  add column if not exists resume_id uuid,
  add column if not exists resume_name text,
  add column if not exists resume_highlights jsonb not null default '[]'::jsonb;
