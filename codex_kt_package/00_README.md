# Codex Knowledge Transfer Package

This package is a handoff for Codex to build a production-grade AI-assisted job search operating system.

## Goal
Build a web application that helps a single user:
- intake and classify job descriptions
- score role fit against a structured achievement bank
- generate tailored application assets
- track applications, contacts, and outcomes
- analyze patterns across the search

## Product Name
Working title: Job Search OS

## Core principle
This is not an auto-apply bot. It is a decision-support and application-generation system with a mandatory human review step before any outbound communication.

## Package contents
- `01_PRODUCT_OVERVIEW.md` — purpose, users, scope, and non-goals
- `02_SYSTEM_ARCHITECTURE.md` — system design and runtime flow
- `03_DATA_MODEL.md` — database schema and entity relationships
- `04_API_SPEC.md` — backend routes and payloads
- `05_AI_WORKERS.md` — worker responsibilities and contracts
- `06_BUILD_PLAN.md` — phased implementation plan
- `07_ACCEPTANCE_CRITERIA.md` — release gates and testable requirements
- `08_ENV_AND_SETUP.md` — local setup and environment variables
- `09_OPENAI_IMPLEMENTATION_NOTES.md` — how to use OpenAI in this app
- `10_PROMPT_CONTRACTS.md` — prompts and output contracts for workers
- `11_UI_MAP.md` — screen map and UX behavior
- `12_RISKS_AND_GUARDRAILS.md` — risks, safety, review policies
- `schema.sql` — starter Postgres schema
- `sources.md` — official docs and references used for this package

## Build target
- Frontend: Next.js + TypeScript
- Backend: Next.js route handlers or Fastify
- Database: Postgres + pgvector
- Auth: Supabase Auth or Clerk
- AI: OpenAI Responses API with structured outputs and function calling
- Hosting: Vercel + Supabase

## Coding preferences
- TypeScript everywhere where practical
- Strict schema validation with Zod
- Small, single-purpose workers instead of one giant agent
- JSON-first generation, with rendering layered on top
- Hard review gates before sending or exporting application materials

## Mandatory product constraints
1. Never send outreach automatically.
2. Never submit applications automatically in v1.
3. Always preserve an audit trail of generated outputs and edits.
4. Every generated asset must be tied to one job and one lane.
5. Every job must be manually approved before asset generation.

## Lane model
The product supports two explicit lanes:
- Lane A: Senior Communications
- Lane B: Strategic Marketing / Partnerships

Every role must route to one lane before generation.
