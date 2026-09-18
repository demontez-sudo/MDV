# CAVYRE 16.13.07 — Relationship / Action Authority

Agent Portal only. Local build; not deployed.

## Purpose
Moves CAVYRE from connected retrieval toward a shared operational relationship layer. The model remains the central entity and authoritative records remain in their existing business tables.

## Added
- Shared relationship evaluator consuming the Model Operating Web graph.
- One normalized model timeline across bookings, castings, calendar events, travel and visa milestones.
- Shared booking/availability, booking/casting and booking/movement conflict detection.
- Shared movement projection from Travel records.
- Shared Visa attention projection from Visa cases.
- Shared operational readiness projection and Season counters.
- Relationship-ready and operational-conflict events so Season, Calendar, Vera and future workspaces can consume one result instead of implementing their own relationship rules.
- Automatic invalidation whenever the Model Operating Web invalidates after a verified Agent write.

## Safety / data authority
This release does not create duplicate Calendar, Season, Travel, Visa or Availability rows. Projections are derived from authoritative records. Future write-through actions must be explicit and verified before changing production business objects.

## Operating rule
ENTER ONCE → AUTHORITATIVE OBJECT → RELATIONSHIP AUTHORITY → PROJECT TO RELEVANT WORKSPACES → INVALIDATE/REFRESH AFTER VERIFIED WRITE.
