# CAVYRE 16.13.03 — Season Operating Authority

This release repairs Season as one operating workspace rather than a set of conflicting legacy routes.

## Fixed
- Removed the stale inline Season runtime that was overriding the repaired external Season authority.
- Talent remains inside Season and renders a dedicated talent view.
- Development remains inside Season; tab clicks stop propagation so the legacy Development page cannot steal the route.
- Shows now renders a full date-grid calendar across the Season start/end window, not only a show list.
- Shows also displays bookings inside the Season window.
- Season API now returns availability blocks, bookings, booking-model links, Visa cases, and Travel records alongside Season data.
- Talent status now factors model availability. Talent rows surface availability plus booking load.
- Movement is fed directly from Travel records and links to Movement / Travel.
- Visa is fed directly from Visa cases for models assigned to the Season and links to the Mobility/Visa desk.
- Season continues to use season readiness, shows, and season model assignments, while availability and bookings now affect the operating view.

## Runtime authority
- One Season renderer: `public/admin/assets/cavyre-vera-smart-season-command-16.13.03.js`.
- One Season guard: `public/admin/assets/cavyre-season-smart-authority-guard-16.13.03.js`.
- Removed the duplicate inline 16.12.48 / 16.12.50 Season renderer from `public/admin/index.html`.

## Scope
Agent Portal only. No Model Portal, MA Portal, public-site, or auth changes.
