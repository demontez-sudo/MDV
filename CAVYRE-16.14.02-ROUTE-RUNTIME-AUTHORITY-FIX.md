# CAVYRE 16.14.02 — Route + Runtime Authority Fix

Root cause found: the deployed Agent project has two HTML authorities. `public/admin/index.html` had been updated, while `public/index.html` still loaded Season 16.13.31. The production custom-domain/proxy path can serve the root Agent document, so the old renderer kept winning even though the new 16.14.01 assets existed.

Fixes:
- synchronized `public/index.html`, `public/admin/index.html`, and `admin/index.html` to 16.14.02
- unique 16.14.02 Season runtime + guard filenames
- direct Season bootstrap before shell runtime, with shell load remaining idempotent
- copied release-critical Season assets to both `/assets` and `/admin/assets` serving paths
- replaced stale global release observer with 16.14.02 authority
- Vera identity mark is self-contained CSS/HTML, no missing external logo asset
- Casting, Shows, Visa layouts remain the 16.14.01 clean rebuild but now load from the actual route authority
- no Supabase schema/auth changes
- no Model Portal or MA Portal changes
- no Netlify deployment performed
