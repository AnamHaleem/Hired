# Hired

Hired is an AI-assisted, human-reviewed job search operating system for structured intake, lane routing, fit analysis, and later application asset generation.

## Deployment stack

- GitHub: source control, pull requests, CI
- Vercel: Next.js hosting and preview deployments
- Railway: PostgreSQL via `DATABASE_URL`
- OpenAI: server-side parsing and later scoring/generation
- Adzuna + public Ashby/Greenhouse/Lever boards: multi-source market search for location sweeps

## Current implementation

The app now covers the Phase 1 foundation plus the core of Phase 2:

- dashboard with intake and scoring visibility
- new job intake
- parser API route
- achievement vault with single-user profile context
- fit scoring API route with retrieval-first evidence ranking
- location sweep route that searches a saved region across Adzuna and public company boards, then filters matches by the selected threshold
- job detail screen showing verdict, angle, proof points, gaps, and objections
- manual approval gate
- local fallback persistence when `DATABASE_URL` is missing
- PostgreSQL schema for jobs, analyses, profiles, lanes, achievements, applications, assets, contacts, interactions, and weekly insights

## Required environment variables

```env
DATABASE_URL=
OPENAI_API_KEY=
APP_URL=http://localhost:3000
OPENAI_PARSER_MODEL=gpt-5.4-mini
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
ADZUNA_COUNTRY=ca
ASHBY_JOB_BOARD_NAMES=
GREENHOUSE_BOARD_TOKENS=
LEVER_POSTING_SITES=
```

## Local development

```bash
npm install
npm run dev
```

If you have a Railway Postgres database available locally or remotely, run:

```bash
npm run db:migrate
```

The current migrations are compatible with standard Railway PostgreSQL. Vector search is being deferred to a later migration so the default Railway Postgres template can be used without a pgvector-specific image.

## GitHub + Vercel + Railway flow

1. Push this repository to GitHub.
2. Create a PostgreSQL service in Railway.
3. Copy Railway's `DATABASE_URL` into your local `.env.local` and into the Vercel project environment variables.
4. Import the GitHub repository into Vercel.
5. Add `OPENAI_API_KEY`, `DATABASE_URL`, `APP_URL`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, and optionally `OPENAI_PARSER_MODEL`, `ADZUNA_COUNTRY`, `ASHBY_JOB_BOARD_NAMES`, `GREENHOUSE_BOARD_TOKENS`, and `LEVER_POSTING_SITES` in Vercel.
6. Run the SQL migrations against Railway Postgres with `npm run db:migrate`.
7. Push to GitHub and let Vercel create preview and production deployments from the connected repo.

## Core routes

- `/` dashboard
- `/jobs/new` job intake
- `/jobs/[id]` parsed review + fit scoring
- `/vault` profile and achievement management
- `/sweep` live market sweep + resume strengthening recommendations
- `/settings` runtime and environment view

## Multi-source market search

Hired now searches:

- Adzuna when `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` are configured
- curated public Ashby, Greenhouse, and Lever company boards by default
- duplicate cross-checking across normalized title, company, location, and URL fingerprints
- optional extra Ashby, Greenhouse, and Lever board tokens from `ASHBY_JOB_BOARD_NAMES`, `GREENHOUSE_BOARD_TOKENS`, and `LEVER_POSTING_SITES`

The optional public-board environment variables accept comma-separated values. You can also use `token|Company Name` to set a clearer label.

## CI

GitHub Actions runs `npm ci` and `npm run build` on pushes and pull requests through `.github/workflows/ci.yml`.
