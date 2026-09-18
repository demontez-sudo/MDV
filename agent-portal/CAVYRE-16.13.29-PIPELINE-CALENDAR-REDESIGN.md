# CAVYRE 16.13.29 — Pipeline + Calendar Redesign

## Season — Casting & Clients
- Replaces the incomplete numeric Option/Callback and Confirmed columns with a complete pipeline dashboard.
- Adds Submitted, Option/Callback, Confirmed, and Conversion KPI cards.
- Each client/show row now has separated submitted, option/callback, confirmed, and conversion-progress states.
- Official Fashion Week schedules remain isolated to Shows; pipeline metrics use actual season_show_models records only.

## Calendar
- Replaces the unfinished volumetric Day canvas with a finished operations agenda built for daily agency use.
- Day view includes event/pending/travel/risk summary, chronological event rail, status markers, model/client/location context, and Vera intelligence.
- Rebuilds 3 Day into a consistent 72-hour command board with three complete day columns.
- Keeps Week and Month functionality and the canonical Calendar data/actions.
- No new database and no automatic operational writes.

## Runtime
- Release authority: 16.13.29.
- New Calendar, Season, and direct visual assets are mirrored to /assets, /admin/assets, and /public/admin/assets.
- No Model Portal or Mother Agency Portal authentication changes.
- Not deployed to Netlify.
