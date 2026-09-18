# CAVYRE 16.13.22 — Direct Season + Orbit Authority

This release stops layering visual overlays on top of legacy Season/Orbit renderers and changes the canonical render sources directly.

## Season
- Loads official Fashion Week datasets before the canonical Season runtime.
- Canonical Season `shows()` merges the supplied official schedule into the active market view without writing synthetic rows to Supabase.
- Shows tab directly renders NYFW / LFW / MFW / PFW switcher, source status, source PDF, event/day counts and day-by-day schedule.
- Overview Show Calendar and Season show count now use the official market schedule.

## Orbit
- Canonical `veux-agent-v16.11.40-calendar-engine.js` day renderer was replaced.
- The circular dial was removed from the rendered day view.
- New Orbit is a 3D vertical spatial timeline with floating event pods, time spine, perspective floor, Vera core and depth layers.
- Existing event selection, intelligence drawer and drag attributes remain.
- Drag-to-time now maps vertically in the new Orbit field.

## M Monogram
- Permanent M is static HTML at the top-left shell edge, no longer dependent on late runtime insertion.

## Safety
- No Supabase schema changes.
- No Model Portal changes.
- No MA Portal changes.
- No Netlify deployment.
