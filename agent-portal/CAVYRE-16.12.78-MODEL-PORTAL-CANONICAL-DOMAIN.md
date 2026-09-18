# CAVYRE 16.12.78 — Model Portal Canonical Domain

## Problem
A model could enter the authentication/reset journey through the site's Netlify hostname.
Because several page transitions were relative (`/portal`, `/portal/reset`, etc.), the browser
would remain on `*.netlify.app` even though Maison de Veux has a branded production domain.

## Fix
All model-facing auth pages now enforce:
`https://maisondeveux.com`

If a model reaches a page on any `*.netlify.app` hostname, the browser immediately redirects
to the same path/query/hash on `maisondeveux.com`.

The following are canonicalized:
- `/portal/auth`
- `/portal/recover`
- `/portal/password`
- `/portal/reset`
- legacy `/model-reset`

Auth/password APIs now return absolute branded redirect destinations as well.

No Calendar, CRM, Tasks, Packages, Season, or model data logic changed.
