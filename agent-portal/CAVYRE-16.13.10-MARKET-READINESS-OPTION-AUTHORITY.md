# CAVYRE 16.13.10 — Market Readiness + Option Authority

## Objective
Move CAVYRE from generic model activity into market-specific operational eligibility without creating duplicate records.

## Changes
- Model Operating Graph now includes canonical `booking_options`, `work_authorizations`, `passports`, and `markets`.
- Added a read-only Market Readiness Authority that derives market readiness from availability, movement, visa/work authorization, conflicts, bookings, and options.
- Normalizes booking-model state into confirmed, option, challenged option, pending, or proposed projections.
- Keeps `booking_options` authoritative; no synthetic option rows are written.
- Exposes market readiness to Vera through the existing shared operational context.
- Reacts to model graph, relationship, and approved-action refresh events.

## Safety / data authority
No inferred readiness or option state is written to Supabase. The layer is derived intelligence over existing authoritative records. No authentication or Model/MA Portal behavior was changed. No Netlify deployment was performed.
