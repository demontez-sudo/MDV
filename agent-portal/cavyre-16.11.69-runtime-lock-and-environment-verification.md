# CAVYRE 16.11.69 — Runtime Lock + Environment Verification

Source: 16.11.68.

## Root causes confirmed
1. Historical feature scripts were still writing their own build numbers into the global release badge and `data-cavyre-release`.
   - `cavyre-calendar-system-reset-16.11.15.js` repeatedly stamped `AGENT 16.11.15`.
   - `veux-agent-v16.11.11-smart-portal.js` also stamped `16.11.15` when rendering.
   - Numerous other historical feature files contained the same anti-pattern.
2. The environment recovery path recreated an empty stage after a shell rebuild instead of recreating the four scene DOM trees.
3. The active scene selector had lower CSS specificity than the base hidden-scene selector, leaving every scene at `opacity:0; visibility:hidden`.

## Fixes
- Removed historical global release stamping from old feature modules while preserving their feature logic.
- Added a single `cavyre-global-release-authority-16.11.69.js`, loaded last.
- Environment stage JS now owns/recreates its full Galaxy, Christmas, Earth and Waterfall scene DOM after any shell rebuild.
- Corrected active scene selector specificity with explicit visible state.
- Removed the obsolete body-level atmosphere path.

## Local browser verification
Headless Chromium was used before packaging:
- Galaxy: scene visible; 5 animated child layers.
- Christmas: scene visible; 4 animated child layers.
- Earth: scene visible; 4 animated child layers.
- Waterfall: scene visible; 9 animated child layers.
- Simulated post-login `.shell` rebuild: stage recreated with all 4 scenes; Waterfall remained visible and animated.
- No image URLs are used by the environment CSS.

This build is intended to eliminate the repeated Netlify deploy loop caused by unverified runtime conflicts.
