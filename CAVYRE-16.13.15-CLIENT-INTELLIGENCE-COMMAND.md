# CAVYRE 16.13.15 — Client Intelligence Command

## What changed
- Adds a dedicated **CLIENT COMMAND** surface to Companies / Clients.
- Reuses canonical CRM detail, CRM Intelligence V2, and Client Fit Intelligence V1.
- Shows relationship strength, booking/casting/package history, casting→booking conversion, client patterns, historically used models, recommended models, finance exposure, follow-up priorities, and upcoming opportunities in one command surface.
- Recommendations are historical client-fit signals only. Protected traits remain excluded and operational readiness is not bypassed.
- Adds a client command context object for Vera (`window.__CAVYRE_CLIENT_COMMAND_CONTEXT__`).
- No duplicate client, booking, casting, package, invoice or relationship database is created.
- No silent writes are performed.

## Safety / authority
- Existing CRM and intelligence endpoints remain authoritative.
- Agent judgment remains final.
- Live submission/booking eligibility should still be checked through VERA MATCH because client-fit history alone does not override availability, visa, travel, option, booking or conflict state.

## Deployment
Not deployed. Package prepared for local validation / explicit deployment approval only.

## VERA MATCH explanation upgrade
- Decision Engine runtime advanced to 16.13.15.
- Candidate cards now expose **CLIENT FIT · WHY** with score, confidence, and up to three verified historical reasons.
- Client-fit explanation remains advisory and cannot override live readiness blockers.
