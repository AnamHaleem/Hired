# API Specification

## POST /api/jobs/parse
Input:
```json
{ "description": "raw job description" }
```
Output:
```json
{
  "company": "Example Corp",
  "title": "Senior Manager, Communications",
  "lane": "senior_communications",
  "level": "senior_manager",
  "must_haves": ["executive communications"],
  "nice_to_haves": ["agency management"],
  "pain_points": ["leadership alignment"],
  "likely_objections": ["hybrid profile risk"],
  "fit_signal_keywords": ["transformation", "stakeholder management"]
}
```

## POST /api/jobs/score
Input:
```json
{
  "job_id": "uuid"
}
```
Output:
```json
{
  "score": 84,
  "verdict": "pursue",
  "best_angle": "Lead with executive advisory and change communications",
  "top_proof_points": ["...", "...", "..."],
  "gaps": ["recent direct people leadership not explicit"],
  "hidden_objections": ["may be viewed as hybrid"]
}
```

## POST /api/jobs/approve
Marks a job ready for asset generation.

## POST /api/assets/generate
Input:
```json
{
  "job_id": "uuid",
  "lane_id": "uuid",
  "asset_types": ["summary", "bullets", "cover_letter", "networking_note"]
}
```
Output:
```json
{
  "application_id": "uuid",
  "assets": {
    "summary": "...",
    "bullets": ["..."],
    "cover_letter": "...",
    "networking_note": "..."
  }
}
```

## GET /api/jobs/:id
Returns job, parsed metadata, score, and generated applications.

## POST /api/contacts
Create a contact record.

## POST /api/interactions
Create an interaction record.

## POST /api/applications/:id/outcome
Update stage, outcome, notes.

## GET /api/analytics/weekly
Returns strategic summary, conversion by lane, and pipeline stats.
