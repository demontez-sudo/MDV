# Maison de Veux 16.9.24 — Branded Admin + Package Routing

## Goal
Keep the Agent Portal and private model packages on the Maison de Veux domain without creating the /team ↔ Agent-origin redirect loop.

## Final routing contract
- `https://www.maisondeveux.com/admin` → 200 reverse proxy to `https://maison-agent.netlify.app/`
- `https://www.maisondeveux.com/admin/*` → 200 reverse proxy to the matching Agent path
- `https://www.maisondeveux.com/api/*` → 200 reverse proxy to Agent APIs
- `https://www.maisondeveux.com/p/*` → 200 reverse proxy to the Agent secure package viewer
- `https://www.maisondeveux.com/team` → temporary 302 handoff to the Agent root. After Agent 16.9.24 is deployed, the Agent root immediately hands the browser to `/admin`. This makes `/team` a safe legacy entry without requiring a third main-site deployment.

## Deployment order
1. Deploy **Main Site 16.9.24 first**. This immediately repairs existing `maisondeveux.com/p/{token}` package links and creates the `/admin` reverse proxy while leaving `/team` safe for the currently deployed Agent build.
2. Deploy **Agent 16.9.24 second**. Direct visits to `maison-agent.netlify.app/` then move to `maisondeveux.com/admin`, which is now safe because `/admin` is a reverse proxy rather than a browser redirect.

## Package behavior
After both deploys, newly sent package emails default to the branded `https://www.maisondeveux.com/p/{token}` URL. The Agent response also retains a direct Agent fallback URL for diagnostics/recovery; the branded URL remains the client-facing primary path.

## What this avoids
- no `/team` ↔ Agent-origin loop
- no `/admin` browser handoff to the raw Netlify origin
- no package 404 caused by an absent `/p/*` rule
- no Agent asset failure under `/admin`; versioned Agent assets are requested through `/admin/assets/*` and proxied to the Agent deployment
- no Agent API failure under the branded host; root `/api/*` is proxied to the Agent Functions runtime
