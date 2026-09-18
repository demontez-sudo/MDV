# CAVYRE 16.12.84 — Deep Dive Recovery

## Root causes found
1. The Agent HTML hard-coded `/admin/assets/...`. If Netlify's effective publish directory is `admin`, those files are published at `/assets/...`, so every hard-coded `/admin/assets/...` request returns 404 even though the files exist in the package.
2. The portal depends on Netlify Functions. A static-only/manual output deploy can publish HTML/CSS/JS but leave `/.netlify/functions/*` unavailable, which makes `/api/config`, `/api/agent/bootstrap`, and `/api/agent/final/v13.7` return 404.
3. Earlier compatibility rules used chained rewrites such as `/admin/api/* -> /api/*`. Chained rewrite behavior is not a safe function-routing authority. 16.12.84 creates direct `/admin/api/... -> /.netlify/functions/...` aliases for every function route.
4. Static asset redirects are unnecessary and fragile. 16.12.84 physically mirrors the full asset/icon/manifest set at both root and `/admin` and uses relative Agent boot references.

## Repair
- Agent boot references are relative (`assets/...`, `icons/...`, `manifest.webmanifest`).
- Root assets are a complete physical mirror of `admin/assets`.
- Static redirect hacks were removed.
- Every API route points directly to its function; every `/api/...` function route has a direct `/admin/api/...` compatibility alias.
- `/admin/*` SPA fallback is last.
- `netlify.toml` now has explicit `[build] publish = "public"` and `[functions] directory = "netlify/functions"` with esbuild bundling.
- A clean `public/` directory prevents server source from being exposed as static files.
- `DEPLOY-CAVYRE-16.12.84.command` deploys both the public site and functions through Netlify CLI.

## Expected live checks
- `/assets/cavyre-head-consolidated-16.11.48.js` => 200
- `/admin/assets/cavyre-head-consolidated-16.11.48.js` => 200 when root project is published
- `/api/config` => 200 JSON
- `/.netlify/functions/public-config` => 200 JSON
- `/api/agent/bootstrap?organization=maison-de-veux` => 401/403 without a token, NOT 404
- `/admin/api/agent/bootstrap?organization=maison-de-veux` => same function response, NOT 404
