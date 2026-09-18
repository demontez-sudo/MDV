# CAVYRE 16.12.85 — Deployment Integrity Recovery

## Confirmed failure pattern
The live screenshot reports `AGENT 16.12.82` while the attempted recovery source is 16.12.84. That proves the production `/admin` page was still serving an older deploy. The browser also returned 404 for both static assets and API routes. This is a deployment/publish mismatch, not a single frontend module crash.

## Changes in 16.12.85
- Package ZIP is flat at the project root (no wrapping `cavyre_16_12_85/` directory).
- Agent release markers normalized to `AGENT 16.12.85`.
- Manifest cache key bumped to 16.12.85.
- Root and `/admin` asset copies retained so `/assets/*` and `/admin/assets/*` both exist in `public/`.
- `public/_redirects` and root `netlify.toml` retained.
- Netlify Functions remain outside the publish directory at `netlify/functions`.
- Deployment command explicitly uploads both `public` and `netlify/functions` and performs live HTTP verification after deploy.

## Production success criteria
1. `/admin` displays `AGENT 16.12.85`.
2. `/assets/cavyre-package-status-16.12.40.css` returns 200.
3. `/admin/assets/cavyre-package-status-16.12.40.css` returns 200.
4. `/manifest.webmanifest` returns 200.
5. `/.netlify/functions/public-config` is not 404.
6. `/api/config` is not 404.
7. `/api/agent/bootstrap?...` is not 404. A 401/403 while logged out is acceptable; a 404 is not.
