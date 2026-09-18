# CAVYRE 16.13.30 — Single Boot Authority Repair

- Repairs the Agent login shell failure caused by 16.13.29 assets existing only under `/admin/assets` while `/assets` was requested.
- Mirrors Calendar, Fashion Week, Season, Season Guard and direct authority CSS to `/public/assets`, `/public/admin/assets`, and `/admin/assets`.
- Removes active legacy Full Wave Orbit, Kinetic Orbit, Model Agency Calendar, Calendar functional/persistence and permanent Calendar authority loaders from Agent boot.
- Disables the inline 16.12.48 Season renderer when 16.13.30 is active.
- Uses one cache query owner: `asset()`; active 16.13.30 shell filenames no longer contain their own `?v=` query.
- Retry cache key follows the current release instead of hard-coded 16.9.68.
- No Model Portal or Mother Agency Portal auth changes.
- No Netlify deployment performed.
