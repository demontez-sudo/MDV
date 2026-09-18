# CAVYRE 16.13.17 — Release Runtime Integrity

## Problem corrected
The 16.13.16 package still contained stale deployment entry authorities outside `public/admin/index.html`:
- `public/index.html` could render `AGENT 16.13.04`.
- root `index.html` still contained older 16.13.02 release writers.
- `public/sw.js` still used `cavyre-agent-shell-16.13.04`.
- root `sw.js` still used `cavyre-agent-shell-16.12.94`.

That meant the visible badge could report an old release even when newer Agent assets existed.

## 16.13.17 authority
- Normalizes root, public, admin, and public/admin entry release writers to `AGENT 16.13.17`.
- Advances both service-worker cache names to `cavyre-agent-shell-16.13.17` so older CAVYRE/VEUX shell caches are removed during activation.
- Adds no-store/no-cache headers for `/`, `/index.html`, `/admin`, `/admin/*`, and `/sw.js`.
- Preserves all 16.13.16 Opportunity Intelligence functionality.
- Does not change Agent authentication, Model Portal authentication, MA Portal behavior, Supabase schema, or operational data.
- No Netlify deployment performed.
