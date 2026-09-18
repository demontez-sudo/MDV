# CAVYRE 16.13.11 — Readiness Workflow Visibility

## Objective
Make the operational intelligence created in 16.13.06–16.13.10 visible where agents actually make model decisions.

## Changes
- Season/Talent now exposes market-specific readiness as **Ready / Conditional / Not Ready**.
- Season rows now surface Availability, Movement, Visa/work-authorization attention, Options, Confirmed bookings, and conflicts in one live status lane.
- Added market-readiness filters inside Season without replacing the existing Season development/readiness filters.
- Expanded the Season read API with canonical `booking_options`, `work_authorizations`, and `passports` so the Season view can use the same source records as the Model Operating Graph.
- Market Readiness Authority now exposes `evaluateGraph(graph)` so any workspace can evaluate an authoritative model graph without creating duplicate state.
- Added a dynamic Booking/Casting/Submission readiness workflow: model-selection surfaces that expose `data-model-id` receive readiness badges and filters for Ready, Conditional, Not Ready, and Conflict.
- The workflow is read-only. It does not block agent selection and does not write inferred readiness back to Supabase.

## Authority / safety
- Booking, option, availability, travel, visa, work authorization, passport, casting, and market records remain authoritative in their existing tables.
- No new duplicate readiness database was created.
- No authentication behavior was changed.
- Model Portal and MA Portal were not changed.
- No Netlify deployment was performed.
