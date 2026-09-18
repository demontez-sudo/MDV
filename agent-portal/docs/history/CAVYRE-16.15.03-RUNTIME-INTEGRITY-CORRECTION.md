# CAVYRE 16.15.03 — Runtime Integrity Correction

Corrects the reported 13-file integrity findings without changing Season behavior.

- One active Calendar engine: `cavyre-calendar-engine-16.15.03.js`, derived from the approved 16.11.40 implementation.
- Unique Calendar runtime guard and matching internal VERSION `16.15.03`.
- Historical/conflicting Calendar engine JS files removed from the deployable package.
- Approved Calendar visual authority and 16.15.01 visual lock remain present and load after the engine.
- Runtime authority metadata aligned to 16.11.58.
- Season 16.14.17 internal authority comment aligned to filename.
- Manifest remains packaged at `public/admin/manifest.webmanifest` and `admin/manifest.webmanifest`.
- Duplicate theme-color removed.
- Task 1500ms polling removed; event/load hooks remain.
- Duplicate reset header blocks consolidated.
- Release headers updated to 16.15.03.
- 16.14.17 documentation reference corrected to 16.11.40.

No Netlify deployment performed.
