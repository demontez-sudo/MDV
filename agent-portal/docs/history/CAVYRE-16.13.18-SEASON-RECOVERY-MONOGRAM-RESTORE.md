# CAVYRE 16.13.18 — Season Recovery + Monogram Restore

## Repairs
- Season GET no longer fails as a whole when a connected optional authority/table or a newer field is unavailable.
- Core Season records remain authoritative; connected intelligence sources now degrade independently and return warnings instead of crashing the page.
- Removes fragile narrow column projections from connected model/booking/visa/market reads so schema drift does not create a 500.
- Restores the desktop `M` monogram to the primary rail and positions the rail below the 64px top bar so the monogram is no longer hidden behind the header.
- Release authority advanced to 16.13.18.

## Safety
- No new database tables.
- No authentication changes.
- No Model Portal or Mother Agency Portal changes.
- No Netlify deployment performed.
