# CAVYRE 16.13.04 — Smart Model Operating Web

This release adds a shared, model-centered operating graph across the Agent portal.

## Core behavior
- One model context can now aggregate availability, bookings, castings, travel, visa cases, tasks, calendar events, season assignments, show assignments, and model documents.
- The new `/api/agent/model-graph/v1` endpoint returns both the raw relationship graph and an intelligence summary (current location, next commitment, open tasks, visa risk, active seasons, booking/casting counts, and availability blocks).
- The browser exposes `CAVYRE_MODEL_WEB` as a shared context service. Pages can request the same authoritative model graph instead of maintaining isolated copies of the model's state.
- Successful Agent writes through the core API bridge invalidate the model graph and emit `cavyre:operating-data-changed` so Calendar, Season, Booking, Movement/Travel, Visa, Tasks, and model surfaces can refresh from the same source.
- Model selection changes automatically warm the graph cache and emit `cavyre:model-web-ready`.

## Safety
- Read-only graph endpoint; no autonomous destructive writes.
- Uses existing Agent authentication, organization boundaries, and `roster.read` permission.
- Optional data sources fail softly and return warnings rather than taking the portal down.
- Existing login/auth, Model Portal, Mother Agency Portal, and public website flows are unchanged.

## Release
Agent release: 16.13.04
