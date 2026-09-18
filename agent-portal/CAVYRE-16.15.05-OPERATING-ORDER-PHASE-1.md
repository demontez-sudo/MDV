# CAVYRE 16.15.05 — Operating Order / Phase 1

Baseline: 16.15.04. No Netlify deployment performed.

## Implemented
- Agency Command: Agency Overview + Priority Stream are moved directly below Vera Intelligence; Smart Roster / Four Calendars / Agency Model / Client Signals follow immediately.
- Primary navigation: Vera Desk is removed if a legacy runtime attempts to add it; Tasks remains a first-class rail destination.
- Tasks v11: canonical endpoint now accepts legacy complete/mark_complete/cancel/mark_in_progress action aliases and assignment/bulk-assignment actions, preventing older active controls from failing against the canonical endpoint.
- Calendar: added a final non-renderer Operating Order authority. Week Command is constrained to a real 7-column board with Vera Intelligence on the right; Calendar controls are visually cleaned. This does not replace the Calendar engine.
- Model Packages: removed the delegated Create Package double-fire that opened the package form twice (legacy modal over the current form).
- Runtime: service-worker cache advanced to 16.15.05; stale release headers advanced; missing brand PNG supplied; missing legacy industry-directory seed fallback supplied.

## Protected / unchanged
- Supabase project and auth architecture.
- Model Portal auth.
- Mother Agency Portal.
- Season data authority.
- Package public/editorial renderer from 16.15.04.

## Next implementation boundary
Model-scoped Development/Travel/Visa routing; Season CRM/Vera relationship actions; Development weekly model submissions; Editorial NY/Paris/Both publishing contract; deeper Calendar event/avatar intelligence after runtime confirmation.
