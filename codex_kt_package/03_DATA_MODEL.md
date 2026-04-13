# Data Model

## Core entities
- profiles
- career_lanes
- achievements
- jobs
- applications
- contacts
- interactions
- job_analyses
- generated_assets
- weekly_insights

## Notes
### profiles
Stores master user profile and base positioning.

### career_lanes
Defines lane-specific positioning and generation defaults.

### achievements
Atomic proof points. This is the most important dataset for quality.
Fields should include:
- company
- role_title
- lane
- industry
- situation
- action
- result
- metrics
- tags
- embedding

### jobs
Stores raw and parsed job descriptions, classification, and fit metadata.

### applications
Stores one application attempt per job and lane pairing.

### generated_assets
Stores summaries, bullet variants, cover letters, and outreach drafts as versioned content.

### contacts
Stores recruiters, hiring managers, and networking contacts.

### interactions
Stores outreach and follow-up history.

### weekly_insights
Stores aggregated strategic recommendations.

## Relationship outline
- one profile -> many career_lanes
- one profile -> many achievements
- one job -> many analyses
- one job -> many applications
- one application -> many generated_assets
- one contact -> many interactions
- one application -> many interactions
