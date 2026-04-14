alter table achievements
  alter column metrics set default '[]'::jsonb;

update achievements
set metrics = '[]'::jsonb
where jsonb_typeof(metrics) = 'object'
  and metrics = '{}'::jsonb;

create index if not exists achievements_tags_idx on achievements using gin (tags);

alter table job_analyses
  add column if not exists top_proof_points jsonb not null default '[]'::jsonb,
  add column if not exists retrieved_achievements jsonb not null default '[]'::jsonb,
  add column if not exists scoring_provider text,
  add column if not exists scoring_model text;
