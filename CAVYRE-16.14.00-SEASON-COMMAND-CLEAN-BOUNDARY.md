# CAVYRE 16.14.00 — Season Command Clean Boundary

- One Season presentation authority: `cavyre-season-command-16.14.00.js/.css`.
- Existing Supabase/API/auth architecture preserved.
- Season UI is scoped under `.cvy1400-season` to prevent legacy CSS collisions.
- Talent filters separated into Season Status and Market Readiness groups.
- Casting & Clients rebuilt as KPI cards + structured pipeline table; canonical castings are preferred over Fashion Week show rows.
- Shows rebuilt as day selector + structured two-column event schedule.
- Visa & Compliance rebuilt as four spaced columns: Model, Visa Type, Case Status, Country/Consulate.
- NYFW/LFW/MFW/PFW source data remains authoritative.
- No Netlify deployment performed.
