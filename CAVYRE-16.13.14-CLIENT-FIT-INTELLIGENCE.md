# CAVYRE 16.13.14 — Client Fit Intelligence

## Objective
Add a transparent, deterministic client-fit layer to the Submission / Booking Decision Engine using verified agency history while keeping operational readiness authoritative and agent judgment final.

## What changed
- Added shared `client-fit-intelligence` authority used by server decision logic.
- Added `/api/agent/client-fit/v1` read-only endpoint for client/company fit analysis.
- Extended `/api/agent/decision-engine/v1` so client fit becomes a scored component when a client/company is known.
- Client fit uses verified signals already stored in CAVYRE:
  - confirmed/accepted/completed booking history,
  - positive casting outcomes,
  - viewed package history,
  - historical measurement patterns,
  - non-sensitive professional model tags,
  - historical market pattern.
- Added confidence grading (`high`, `medium`, `low`, `insufficient`) based on evidence depth.
- Added a visible Client Fit Intelligence panel in VERA MATCH rankings.
- Added per-model Client Fit score and confidence to decision cards.
- Added the client profile to the Decision Engine payload so Vera can receive the same decision context.

## Safety / decision policy
- Read-only intelligence: no booking, casting, option, submission, task, travel, visa, or availability writes are made by this layer.
- Protected/sensitive traits are excluded from the historical preference model.
- Client history is treated as advisory evidence, not a rule and not a hard blocker.
- Hard operational conflicts still cap a candidate ranking regardless of historical client fit.
- Final model selection remains an explicit agent decision.

## Architecture
`CLIENT HISTORY -> VERIFIED OUTCOMES -> CLIENT FIT PROFILE -> MODEL FIT SIGNAL -> DECISION ENGINE -> AGENT REVIEW`

## Files
- `netlify/functions/_lib/client-fit-intelligence.mjs`
- `netlify/functions/agent-client-fit-intelligence-v1.mjs`
- `netlify/functions/agent-decision-engine-v1.mjs`
- `admin/assets/cavyre-submission-booking-decision-engine-16.13.14.js`
- `admin/assets/cavyre-submission-booking-decision-engine-16.13.14.css`
- mirrored `public/admin/assets/*`
- `admin/index.html`
- `public/admin/index.html`
- `netlify.toml`
- `public/_redirects`

## Deployment
Not deployed. Local build/validation only.
