# CAVYRE 16.13.05 — Connected Season Operating Web

Agent Portal only. No Model Portal, MA Portal, authentication, or global visual redesign changes.

## What this release repairs
- Makes the 16.13.05 Season renderer authoritative even when a stale legacy Season renderer paints first or repaints later.
- Keeps Talent and Development inside Season.
- Builds Season Talent as an operating union: explicit Season assignments plus models with in-window Bookings, Availability, Movement, Visa, or Casting activity.
- Expands the Season API read graph to include Models, Castings, Casting Models, Calendar Events, Development Activities, and Tasks alongside existing Season, Availability, Booking, Travel, Visa, Show, Client and Market authorities.
- Movement is filtered to current Season talent and the Season date window, while remaining sourced from `travel_records`.
- Visa remains sourced from `visa_cases`; Season does not create a second Visa database.
- Shows Calendar uses Season dates and can fall back to agency-approved Fashion Week source dates. Calendar days combine Shows, Castings and Bookings in one date grid.
- Fashion Week source upload/render now supports both `p-seasonmanagement` and `p-season` hosts.
- Adds a mutation guard so a late legacy renderer cannot silently replace Connected Season.

## Data principle
Season is a read/operating projection of authoritative portal objects, not a duplicate database. The connected model activity path is progressively represented as:

MODEL → AVAILABILITY → SEASON → CASTING → OPTION/BOOKING → CALENDAR → TRAVEL → VISA → CLIENT/SHOW → TASKS → DEVELOPMENT → RESULTS

## Deployment
Not deployed. Validate locally first and deploy only after explicit approval.
