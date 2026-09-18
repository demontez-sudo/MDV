# CAVYRE 16.11.68 — Workspace Environment Stage

Built from 16.11.67.

## Root cause repaired
Previous cinematic animation was attached to the document/body layer and remained vulnerable to the portal's opaque `.shell` and `.pm` paints.

## New architecture
`.shell`
- `#cavyre-environment-stage` (z-index 0)
- `.sidenav` (z-index 2)
- `#pm` workspace (z-index 2)

The environment is therefore inside the same stacking context as the workspace and cannot be hidden by the shell background.

## Four native DOM scenes
- Galaxy: two moving nebula layers + three independent star planes.
- Christmas: seasonal forest/ruby/gold scene + CSS tree silhouettes + twinkling lights + two snow planes.
- Earth: animated planet + atmospheric rim + aurora + moving stars.
- Waterfall: five independent cascade columns + moving water texture + spray + two mist layers.

## Conflict removal
- Removed the old 16.11.67 body-level motion authority from HTML load paths.
- Disabled obsolete `#cavyre-cinematic-atmosphere` creation in the 16.11.61 appearance controller while preserving palette and selector behavior.
- New runtime removes any late legacy atmosphere node if an old module attempts to recreate it.

## Constraints
- No image backgrounds.
- No `url()` image assets.
- Existing 14 Color Wave selector preserved.
- Original 10 waves remain unchanged.
