# CAVYRE 16.13.13 — Submission / Booking Decision Engine

## Scope
Agent Portal only. Local build. Not deployed.

## What changed
- Added a read-only server decision engine at `/api/agent/decision-engine/v1`.
- Added ranked model matching inside Booking, Casting, Option and Submission selection contexts.
- Ranking uses authoritative CAVYRE records rather than inferred duplicate rows.
- Added a `VERA MATCH / RANK MODELS` control to compatible model-selection surfaces.
- Added a Decision Engine drawer with candidate rank, total match score, readiness, measurement fit, option position, client booking history and conflict counts.
- Added `WHY?` handoff into the existing 16.13.12 Readiness Decision Authority.
- Added explicit `SELECT` action for the agent; CAVYRE does not auto-submit or auto-book a model.
- Publishes the most recent ranking to `window.__CAVYRE_DECISION_ENGINE_CONTEXT__` and Vera state when available.

## Authoritative inputs
- `models`
- `model_measurements`
- `model_market_assignments`
- `markets`
- `availability_blocks`
- `booking_models` + `bookings`
- `casting_models` + `castings`
- `booking_options`
- `travel_records`
- `visa_cases`
- `work_authorizations`

## Ranking dimensions
The engine uses deterministic scoring and redistributes weight only across dimensions that have usable evidence.

Base dimensions:
- Market / operational readiness — 40
- Availability — 15 when a target window exists
- Explicit measurement requirements — 20 when supplied by the current workflow
- Option position — 10
- Prior booking history with the current client — 15 when a client/company is known

Hard availability or booking conflicts cap the ranking. A model with verified blockers cannot be promoted to a top operational match solely because of measurement or client-history fit.

## Safety / agency control
- Read-only endpoint.
- No automatic Booking, Casting, Option, Submission, Travel, Visa, Availability or Task write.
- Ranking is advisory and transparent.
- Final model selection remains an explicit agent action.
- Existing blocker-specific actions continue through the 16.13.12 Readiness Decision Authority and 16.13.09 Operational Action Authority.

## Runtime rule
**CLIENT REQUEST → VERIFIED CONTEXT → RANK MODELS → EXPLAIN WHY → AGENT SELECTS → EXISTING VERIFIED WORKFLOW WRITES**

## Validation
- Node syntax validation passed for the new MJS endpoint and Agent JS runtime.
- `admin/` and `public/admin/` runtime assets are mirrored.
- New redirect targets resolve to the new function file.
- Final ZIP integrity tested before handoff.
