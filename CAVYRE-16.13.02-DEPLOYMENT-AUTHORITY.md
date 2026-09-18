# CAVYRE 16.13.02 — Agent Deployment Authority

## Root cause corrected
Netlify publishes the `public/` directory. The prior Season 16.13.00 assets and page changes existed under the duplicate top-level `admin/` tree, while `public/admin/` remained the older 16.12.97 runtime. A ZIP upload could therefore succeed while production still served the old Agent UI.

## Fixes
- Promoted the Season 16.13.00 source-upload assets into `public/admin/assets/`.
- Synchronized `public/admin/index.html` with the Season-enabled Agent entry page.
- Normalized visible Agent release writers to **AGENT 16.13.02**.
- Updated the service-worker shell cache to `cavyre-agent-shell-16.13.02`.
- Added no-cache headers for `/admin/index.html` and `/sw.js`.
- Preserved existing Agent auth, Model Portal, MA Portal, CRM, Calendar, and backend function code.

## Deployment target
Deploy this ZIP only to the existing Netlify project `maison-agent`. The build publish directory remains `public`.
