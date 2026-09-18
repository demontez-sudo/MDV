# CAVYRE 16.12.71 — Three-Day Calendar Scroll Lock

## Repair
The approved 3-Day / Runway Timeline design was being clipped by a legacy fixed-height shell using `overflow:hidden`.

This release keeps the approved Calendar design and changes only its scrolling behavior:

- The 3-Day calendar main column is now the vertical scroll container.
- The day headings remain sticky while scrolling through the hours.
- The Calendar legend remains available at the bottom.
- Vera / Model Intelligence remains in the right column and can scroll independently when needed.
- Legacy shell `overflow:hidden` can no longer clip the 3-Day schedule.
- Mobile/tablet falls back to normal page scrolling.
- No event, Calendar API, geometry, drag/drop, model schedule, CRM, Package, Season, or authentication logic was changed.

## Authority
This override is included both in the Calendar authority stylesheet and inline in root/admin HTML so later legacy styles cannot silently remove the scroll behavior.
