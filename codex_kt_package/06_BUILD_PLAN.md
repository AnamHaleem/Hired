# Build Plan

## Phase 1: Foundation
- Set up Next.js app
- Add auth
- Create database schema
- Create job intake UI
- Implement job parser endpoint
- Save parsed jobs

## Phase 2: Retrieval and scoring
- Build achievement import pipeline
- Generate embeddings for achievements
- Add retrieval RPC
- Implement fit scorer endpoint
- Add job detail screen with score and recommendation

## Phase 3: Asset generation
- Build asset generator endpoint
- Add review UI
- Add versioned storage for assets
- Add export to markdown and copy-friendly text

## Phase 4: CRM and analytics
- Contacts and interactions UI
- Outcome tracking
- Weekly strategy endpoint
- Dashboard metrics and lane conversion charts

## Phase 5: Hardening
- Logging and tracing
- Prompt versioning
- retry and fallback behavior
- evaluation harness for parsing and generation quality

## Recommended order inside Phase 1
1. schema
2. auth
3. intake form
4. parser route
5. parsed job details page
