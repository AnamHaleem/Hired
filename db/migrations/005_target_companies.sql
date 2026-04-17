create table if not exists target_companies (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  company_name text not null,
  careers_url text,
  provider text not null,
  provider_key text,
  status text not null default 'needs_review',
  detection_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists target_companies_created_at_idx
  on target_companies (created_at desc);

create index if not exists target_companies_profile_id_idx
  on target_companies (profile_id);

create index if not exists target_companies_provider_key_idx
  on target_companies (provider, provider_key);
