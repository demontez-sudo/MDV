# CAVYRE 16.12.82 — Portal Boot Routing Recovery

This release repairs the Agent Portal boot path after 16.12.81.

## Repairs
- Keeps `/api/*`, `/api/config`, and `/health` at the site root instead of rewriting them to `/admin/api/*`.
- Stops the global fetch wrapper from silently prefixing API calls with `/admin`.
- Removes self-referential `/admin/assets/*` and `/admin/manifest.webmanifest` rewrites so real files can be served directly.
- Adds a root `_redirects` file mirroring the function routes for Netlify Drop compatibility.
- Preserves the existing Agent Portal UI, data model, authentication credentials, calendar, CRM, roster, packages, and Model Portal logic.

Expected boot requests now include:
- `/api/config`
- `/api/agent/bootstrap?organization=maison-de-veux`
- `/api/agent/final/v13.7?...`

They must no longer appear as `/admin/api/...`.
