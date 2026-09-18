# CAVYRE 16.13.19 — Fashion Week Schedule + Orbit Visual Authority

## What this release fixes

### 1. NYFW schedule is now visible inside Season
- Adds the agency-approved CFDA Official New York Fashion Week Schedule directly to the NYFW Season workspace.
- Includes 70 primary runway/presentation events from September 10–15, 2026.
- The schedule no longer depends on a production PDF metadata record being present before agents can see the official NYFW calendar.
- The Overview Show Calendar is populated from the official schedule when no internal Season show records exist.
- The Season SHOWS KPI reflects the official schedule count for NYFW.
- The full official schedule remains advisory/source-backed and does not create duplicate booking/show database records.

### 2. Permanent M monogram restored
- Adds a fixed Maison `M` brand control to the true top-left corner of the Agent shell.
- It is independent of the legacy `.vx73-monogram` rule that was being hidden by the single-navigation CSS authority.
- Clicking the monogram routes back to Overview.

### 3. Orbit upgraded to cinematic 3D
- Adds layered depth planes, orbital beam, star field, deeper shadows, Z-depth, brighter selected-event lift and subtle pointer parallax.
- Existing Orbit event selection, Model Intelligence, drag/drop and event opening behavior are preserved.
- No Calendar data model changes were made.

## Authority
- Agent release: 16.13.19
- Service worker cache: cavyre-agent-shell-16.13.19
- No Supabase schema changes.
- No Model Portal or Mother Agency Portal changes.
- No Netlify deployment performed.
