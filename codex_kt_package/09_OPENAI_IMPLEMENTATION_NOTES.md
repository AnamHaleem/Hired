# OpenAI Implementation Notes

## Recommended usage pattern
Use the Responses API for parsing, scoring, and generation.

## Models
Recommended default split:
- parser and fit scoring: smaller capable model
- high-value generation: stronger model
- weekly analytics: smaller capable model unless reasoning depth is clearly needed

## Guidelines
1. Use structured outputs with Zod-backed schemas for parser and scorer.
2. Use server-side API calls only.
3. Save prompt version, model name, and analysis inputs for auditability.
4. Keep worker prompts short, explicit, and single-purpose.
5. Retrieval should happen before generation.

## Failure handling
- Retry once on transient errors.
- If schema parse fails, surface raw output only in logs, not in UI.
- Keep analysis artifacts so scoring can be replayed later.
