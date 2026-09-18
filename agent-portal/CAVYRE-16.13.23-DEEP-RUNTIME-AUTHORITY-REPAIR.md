# CAVYRE 16.13.23 — Deep Runtime Authority Repair

Deep scan found the prior releases changed files but did not reliably own the live runtime.

## Root causes fixed
1. Calendar shell still requested `veux-agent-v16.11.40-calendar-engine.js?v=161140`; the filename/query stayed old, so a previously cached/CDN copy could render the circular Orbit even though source bytes in the ZIP had changed. 16.13.23 loads a new uniquely named calendar authority *after* `veux:shell-ready`, so it wins the runtime.
2. Season 16.13.22 reused the legacy `__CAVYRE_SMART_SEASON_161248__` guard/global contract. A prior Season authority could make the new runtime exit before installing. 16.13.23 uses a unique guard/global and a matching guard that only targets 16.13.23.
3. The legacy 16.12.02 Season authority loader was still present and could repaint Season after the new runtime. It is removed from the active Agent entry points.
4. Critical 16.13.22 visual authority (including the M monogram) depended on a new external CSS request. 16.13.23 inlines the critical authority CSS in both Agent entry points and also ships the standalone stylesheet.
5. Fashion Week time parsing contained an over-escaped regex. Corrected.

## Runtime ownership
- Season: `cavyre-vera-smart-season-command-16.13.23.js`
- Season guard: `cavyre-season-smart-authority-guard-16.13.23.js`
- Fashion Week data: `cavyre-fashion-week-data-16.13.23.js`
- Calendar/Orbit: `cavyre-calendar-engine-16.13.23.js`, loaded after shell-ready
- Critical visuals/M: inline 16.13.23 CSS + standalone CSS

No Netlify deployment performed.
