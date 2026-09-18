# CAVYRE 16.12.70 — Permanent Calendar Design Authority

This release restores the approved 16.11.78 Calendar visual authority and makes it the final Calendar-only design authority.

Changes:
- Removed automatic 16.12.34 Calendar Production Authority loader that was restoring the older Runway Timeline / Three Day layout.
- Embedded the approved 16.11.78 Calendar CSS and JS at the end of both root and admin HTML.
- Added a scoped guard that removes only the conflicting 16.12.34 Calendar production authority if legacy code attempts to inject it.
- Preserves Calendar data engine, duration geometry, drag/drop, model schedule, event APIs, Vera, CRM, Packages, Season, and authentication.
- No database migration.

Design contract:
- Approved Calendar is the only final visual authority.
- Vera Model Intelligence remains on the right on desktop.
- Industry Intelligence remains below the Calendar.
- Week remains seven equal columns.
- Other feature releases must not replace the Calendar design.
