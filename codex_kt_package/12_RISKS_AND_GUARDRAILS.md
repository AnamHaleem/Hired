# Risks and Guardrails

## Risks
- Overconfident fit scores
- Hallucinated experience in generated assets
- Weak retrieval causing generic outputs
- Lane confusion for hybrid jobs
- Drift in prompts across versions

## Guardrails
1. Require retrieved evidence for all generation.
2. Show top supporting achievements before generation.
3. Save all generated versions.
4. Require manual approval before asset generation.
5. Flag hybrid or ambiguous jobs for extra review.

## Product safety stance
This product supports human decision-making. It does not impersonate the user, send outreach, or submit applications automatically in v1.
