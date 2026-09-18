# CAVYRE 16.12.99 — Season Fashion Week PDF Source Authority

Adds an Agent-only Season control for attaching the exact Fashion Week dates PDF used by the agency.

## Agent workflow
1. Open Season.
2. Select **UPLOAD FASHION WEEK PDF** or **+ ADD FASHION WEEK PDF**.
3. Choose the market, calendar/category, season, year, issuer, status and exact date range.
4. Upload the PDF.
5. CAVYRE stores the PDF in secured agency document storage and persists its Season source metadata.
6. The source appears directly on the Season front page under **OFFICIAL DATE SOURCES**.

## Label standard
The default label is composed as:

`MARKET · CATEGORY · SEASON YEAR · OFFICIAL FASHION WEEK DATES`

Example:

`PARIS · WOMEN · SPRING / SUMMER 2027 · OFFICIAL FASHION WEEK DATES`

Agents may edit the final label before upload.

## Scope
- Uses existing authenticated `/api/storage/upload-url` and `/api/storage/finalize` document authority.
- PDF-only source upload.
- Staff visibility by default.
- No Model Portal, MA Portal or public site changes.
- Does not yet auto-extract dates from the PDF. This release creates the secure source/label authority required before automated date scanning is added.
