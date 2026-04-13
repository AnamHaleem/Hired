# Acceptance Criteria

## Job parsing
- Given a pasted job description, the system stores raw text and parsed JSON.
- Parsed output always conforms to schema.
- If parsing fails, the UI shows a recoverable error.

## Fit scoring
- Score must be reproducible from saved analysis inputs.
- Score response includes verdict, best angle, gaps, and objections.
- Retrieved proof points are visible to the user.

## Asset generation
- Every asset is linked to one application record.
- Every asset can be regenerated without deleting older versions.
- User can edit generated content before saving final version.

## CRM
- User can track stage, outcome, and notes for each application.
- User can link contacts and interactions to an application.

## Strategy
- Weekly summary includes conversion by lane and top bottleneck.
- Strategy output is saved with timestamp.

## Safety and control
- No outbound message is sent automatically.
- No application submission is performed automatically in v1.
