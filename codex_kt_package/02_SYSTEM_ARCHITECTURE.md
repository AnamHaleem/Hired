# System Architecture

## High-level architecture
- Next.js web app for UI and server routes
- Postgres for structured application data
- pgvector for semantic retrieval of achievements
- OpenAI Responses API for parsing, scoring, and generation
- Optional background jobs for embeddings and analytics

## Runtime flow
1. User pastes a job description.
2. Backend parses the job into structured JSON.
3. Rules engine assigns preliminary lane and level risk.
4. Retrieval layer finds the most relevant achievement records.
5. Fit scorer returns score, verdict, objections, and angle.
6. User approves the role.
7. Generator creates application assets.
8. Outputs are saved and linked to the job.
9. User records follow-ups and outcomes.
10. Strategy worker produces weekly insights.

## Design decisions
### Why retrieval-first
The model should not reason over one giant career blob. The system should retrieve a small set of relevant proof points for each job and use those as grounded evidence.

### Why two lanes
The candidate profile is hybrid. Generation should not mix lanes by default because that weakens the fit signal.

### Why rules + AI
AI interprets nuance. Rules enforce consistency. Examples:
- low fit score means pass
- too many missing must-haves means maybe
- hybrid lane requires manual review

## Suggested deployment
- Frontend and API on Vercel
- Postgres and vector storage on Supabase
- cron-like weekly analytics via Supabase scheduled functions or a lightweight worker

## Security model
- Auth required for all screens except login
- Server-side calls to OpenAI only
- No client exposure of API keys
- Role-based access is not needed in v1 because single-user mode
