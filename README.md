# Hired

Hired is an AI-assisted, human-reviewed job search operating system for structured intake, lane routing, fit analysis, and later application asset generation.

## Deployment stack

- GitHub: source control, pull requests, CI
- Vercel: Next.js hosting and preview deployments
- Railway: PostgreSQL via `DATABASE_URL`
- OpenAI: server-side parsing and later scoring/generation

## Current implementation

The app currently covers the Phase 1 foundation:

- dashboard
- new job intake
- parser API route
- manual approval gate
- local fallback persistence when `DATABASE_URL` is missing

## Required environment variables

```env
DATABASE_URL=
OPENAI_API_KEY=
APP_URL=http://localhost:3000
OPENAI_PARSER_MODEL=gpt-5.4-mini
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

## GitHub + Vercel + Railway flow

1. Push this repository to GitHub.
2. Create a PostgreSQL service in Railway.
3. Copy Railway's `DATABASE_URL` into your local `.env.local` and into the Vercel project environment variables.
4. Import the GitHub repository into Vercel.
5. Add `OPENAI_API_KEY`, `DATABASE_URL`, `APP_URL`, and optionally `OPENAI_PARSER_MODEL` in Vercel.
6. Run the SQL migrations against Railway Postgres with `npm run db:migrate`.
7. Push to GitHub and let Vercel create preview and production deployments from the connected repo.

## CI

GitHub Actions runs `npm ci` and `npm run build` on pushes and pull requests through `.github/workflows/ci.yml`.
