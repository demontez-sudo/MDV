# CAVYRE 16.14.01 — Season Visual Rebuild

## Scope
Season presentation only. No database duplication, authentication changes, Model Portal changes, MA Portal changes, or Netlify deployment.

## Casting & Clients
- Rebuilt KPI strip into four isolated metric cards: Submitted, Option / Callback, Confirmed, Conversion.
- Rebuilt the pipeline as a true aligned data grid.
- Removed the fallback that treated Fashion Week show records as casting records.
- Added a deliberate empty state with separate Relationships and Casting Desk actions.

## Official Calendar / Shows
- Rebuilt the official calendar into a date selector plus a clean vertical event schedule.
- Each show has a dedicated row with time, designer, format/location, official state and navigation affordance.
- Source metadata, source PDF action, official event count and calendar-day count are separated and aligned.

## Visa & Compliance
- Rebuilt as a dashboard graph + structured table.
- Summary graph: Active Cases, In Progress, Needs Attention, Clear / Approved.
- Per-model table: Model, Visa Type, Case Status, Country / Consulate, Deadline.
- Status receives explicit visual state treatment.

## Runtime authority repair
- Corrected Season release marker/observer authority to 16.14.01.
- Corrected the Season authority guard to target the current 16.14.01 runtime instead of 16.13.31.
- Added last-loaded Season CSS authority to prevent legacy CSS from flattening the new components.
- Ensured all 16.14.01 shell asset references exist in both public/admin and admin mirrors.

## Validation
- Node syntax checks passed for changed/new JS.
- Local asset-reference scan: zero missing local files in public/admin and admin.
- ZIP integrity tested with unzip -t.
