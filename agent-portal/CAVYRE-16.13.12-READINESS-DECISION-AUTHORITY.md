# CAVYRE 16.13.12 — Readiness Decision Authority

Scope: Agent Portal only. No Netlify deployment. No Model Portal, Mother Agency Portal, authentication, or database schema changes.

## Purpose
16.13.12 turns visible readiness badges into an agent decision surface. When a model is selected in a Booking, Casting, Submission, Option, or Season-related talent surface, CAVYRE can immediately explain why the model is Ready, Conditional, or Not Ready and expose the correct next operational action.

## Decision inputs
The decision drawer reads the existing Model Operating Web and shared authorities. It derives context from authoritative:
- Availability blocks
- Travel / Movement
- Visa cases / work authorization readiness
- Booking Options
- Confirmed Bookings
- Casting / Booking / Movement conflicts
- Market Readiness Authority

No duplicate readiness records are created.

## Selection-time behavior
- A `WHY?` control is added beside model readiness badges.
- Selecting a model in compatible Booking/Casting/Submission/Option surfaces opens the decision drawer automatically.
- The drawer shows target market, readiness score, blockers, connected checks, and a concise recommendation.
- Ready models are not artificially blocked.
- Conditional / Not Ready models remain selectable because the agent retains final authority.

## Next actions
The decision surface can:
- Open Visa & Compliance when authorization is the blocker.
- Open Travel & Mobility when market movement is the blocker.
- Open the model profile for availability review.
- Open Calendar/Castings for schedule or option review.
- Create a follow-up Task through the existing verified Operational Action Authority.

Task creation still requires explicit agent confirmation and a `verified:true` write response. No inferred task is silently written.

## Safety / authority
- Readiness is derived intelligence, not a new database authority.
- The decision layer does not silently change Booking, Casting, Option, Travel, Visa, Availability, or Calendar records.
- Option conflict resolution is review-first; the decision layer opens the authoritative Calendar/Booking workflow instead of inventing a new option mutation route.
- Model Portal and Mother Agency Portal remain unchanged.
