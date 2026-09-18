# CAVYRE 16.13.08 — Shared Operational Intelligence

## Objective
Consolidate Season, Calendar and Vera onto the shared Model Operating Web / Relationship Authority instead of allowing each workspace to maintain separate conflict and readiness logic.

## Changes
- Season 16.13.08 consumes `CAVYRE_RELATIONSHIPS.evaluate()` for per-model readiness, availability, movement, visa and conflicts, while retaining a safe fallback during boot.
- Season re-renders when shared relationship intelligence becomes available.
- Calendar receives a non-destructive Connected Operations intelligence strip for the active model. It surfaces shared movement, visa attention and operational conflicts without creating duplicate calendar records.
- Vera receives the same operational graph in its context payload: readiness, movement, visa attention, availability, conflicts and unified activity timeline.
- Existing authoritative records remain unchanged: bookings, castings and calendar events continue to come from their existing APIs; travel remains Travel; visa remains Visa; availability remains Availability.
- No inferred projection is silently written to production.

## Architecture
Authoritative records → Model Operating Web → Relationship Authority → Shared Operational Intelligence → Season / Calendar / Vera.

## Safety / release rules
- No Netlify deployment performed.
- No authentication changes.
- No Model Portal or MA Portal changes.
- No Supabase schema duplication.
- New JS syntax validated for both admin and public/admin copies.
