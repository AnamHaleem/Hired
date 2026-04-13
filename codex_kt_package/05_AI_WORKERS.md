# AI Workers

## Worker 1: Job Parser
Purpose: Convert raw job descriptions into strict structured output.

Input:
- raw job text

Output:
- company
- title
- lane
- level
- must_haves
- nice_to_haves
- pain_points
- likely_objections
- fit_signal_keywords

## Worker 2: Achievement Retriever
Purpose: Retrieve relevant proof points using semantic search and rule filters.

Input:
- parsed job
- lane

Output:
- top 10 achievements ranked by relevance

## Worker 3: Fit Scorer
Purpose: Decide whether the job should be pursued.

Input:
- parsed job
- retrieved achievements
- profile and lane context

Output:
- score
- verdict
- best angle
- top proof points
- gaps
- hidden objections

## Worker 4: Asset Generator
Purpose: Create tailored application assets.

Input:
- parsed job
- lane
- retrieved achievements
- selected proof points

Output:
- summary
- bullet rewrites
- cover letter
- networking note
- recruiter message
- interview pitch

## Worker 5: Weekly Strategist
Purpose: Analyze conversion and advise on direction.

Input:
- applications
- outcomes
- interactions

Output:
- strongest lane
- strongest title family
- bottleneck stage
- action recommendations

## Worker design rules
1. Single responsibility only.
2. Structured outputs first.
3. Never rely on hidden memory.
4. Always tie outputs to retrieved evidence.
5. Never auto-send anything.
