# CAVYRE 16.14.17 — Calendar Clean-Room Restore

This release stops redesigning Calendar and restores the actual approved Calendar renderer lineage.

- Current Calendar engine is restored from `veux-agent-v16.11.40-calendar-engine.js`, the renderer that produces the approved `vx75-orbit`, `vx95-runway-shell`, `vx89-flow-dashboard`, and `vx85-season` structures.
- The approved `cavyre-calendar-authority-16.11.78.css/js` remains the final Calendar-only visual authority.
- The later `cvy1323` volumetric Calendar override is removed from the Agent HTML. Those classes belonged to the later replacement Calendar, not the approved Calendar.
- Login shell remains protected; all required versioned shell assets are present.
- No Supabase schema, auth contract, Model Portal, or Mother Agency Portal changes.

Release rule: Calendar renderer and 16.11.78 visual authority are frozen. Non-Calendar releases must not alter them.
