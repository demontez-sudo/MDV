# CAVYRE 16.12.83 — Compatibility Routing Hardening

This release fixes the persistent 404 boot failure by making routing tolerant of both current and cached portal clients.

- Root `/assets/*` requests are served from `/admin/assets/*`.
- Root manifest is served from the Agent Portal manifest.
- Legacy `/admin/api/...` calls are mapped to the correct Netlify functions/API routes.
- Canonical `/api/...` routes remain unchanged.
- The `/admin/*` SPA fallback remains last so it cannot swallow Agent API compatibility routes.
- Known `../assets/...` references in `admin/index.html` are normalized to `/admin/assets/...`.

Release badge: AGENT 16.12.83.
