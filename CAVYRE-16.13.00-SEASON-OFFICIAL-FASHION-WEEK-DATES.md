# CAVYRE 16.13.00 — Season Official Fashion Week Dates

## Scope
Agent Portal / Season only.

## Change
The Fashion Week PDF source now drives a visible **Official Fashion Week Dates** section directly on the Season front page.

- Start Date and End Date are required when an agent uploads a Fashion Week PDF.
- Every date in the exact range is rendered as a Season date card.
- Each card is labeled `FASHION WEEK · OFFICIAL`.
- Market, category, season and year remain attached to every displayed date.
- The source PDF remains one click away from the date group.
- Existing source PDFs that already include `starts_on` / `ends_on` metadata appear automatically.
- No Agent authentication, Model Portal, MA Portal, CRM or Calendar runtime was changed.

## Authority
`window.CAVYRE_SEASON_OFFICIAL_DATES` exposes the official date rows for future Calendar / Casting / Movement connections.
