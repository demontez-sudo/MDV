# CAVYRE 16.13.06 — Operational Graph Authority

Agent Portal only. Not deployed.

## Connected operating behavior
- Season remains a projection of authoritative Models, Availability, Bookings, Castings, Travel, Visa, Development, Tasks, Clients, Shows and Calendar data.
- Adds a shared operational readiness calculation inside Season: explicit readiness + availability + visa + scheduling conflicts + readiness requirements.
- Adds conflict detection for booking vs unavailable/bookout blocks, booking vs casting overlap, and booking vs travel/location risk.
- Adds movement state from authoritative Travel records.
- Talent and Development remain native Season views; they do not navigate away.
- Season automatically re-reads after verified Agent writes broadcast through the Model Operating Web.
- Shows remains a date-grid operating calendar combining approved season dates, Shows, Castings and Bookings.
- Movement and Visa remain projections of `travel_records` and `visa_cases`; no duplicate Season stores were added.
- Model Operating Web cache is invalidated on Agent writes so connected workspaces can refresh from authoritative data.

## Architecture rule
ENTER ONCE → RELATE ONCE → INVALIDATE/REFRESH CONNECTED CONTEXT → EVERY RELEVANT WORKSPACE RE-READS AUTHORITATIVE DATA.

This release does not silently create calendar, travel, visa, booking, or task records from inferred data. Automated write-through actions must remain explicit/verified to avoid duplicate business objects.
