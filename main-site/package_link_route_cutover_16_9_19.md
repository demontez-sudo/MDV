# Maison de Veux Main Site 16.9.19 — Package Link Route Cutover

## Problem confirmed
Resend successfully delivered a package email whose branded URL is `https://maisondeveux.com/p/{token}`, while the live main Maison site returned Netlify's generic 404. The corresponding MOGY `package_share_links` row is active and has not been viewed, so the bearer link itself is valid.

## Fix
The public site now declares the package viewer and package APIs in both Netlify routing formats:

- `_redirects` — first-processed forced 200 proxy safeguard
- `netlify.toml` — authoritative structured route configuration

Routes:
- `/p/*` -> `https://maison-agent.netlify.app/p/:splat`
- `/api/public/package` -> `https://maison-agent.netlify.app/api/public/package`
- `/api/public/package/feedback` -> `https://maison-agent.netlify.app/api/public/package/feedback`

These routes are ordered before the dynamic one-segment model profile fallback.

## Deployment scope
Deploy this ZIP only to the existing main Maison de Veux Netlify project. Do not deploy it to `maison-agent`, `maison-models`, or an individual model site.

After deployment, retry the already-delivered email link before resending the package. The existing active share link should resolve without creating another package recipient/share-link record.
