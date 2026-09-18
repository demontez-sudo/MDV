# CAVYRE 16.11.61 — Cinematic Portal Color Waves

Built on 16.11.60 Resilient Smart CRM Forms.

## New Appearance Waves
- Galaxy — animated procedural nebula + star field; violet/cobalt glass palette.
- Christmas — luxury forest/ruby/candle-gold atmosphere with subtle drifting light particles.
- Earth — orbital teal/emerald horizon with midnight blue and warm gold signals.
- Waterfall — cyan/teal vertical light flow with animated mist.

## Rendering contract
- No new image files are used by these themes.
- No remote backgrounds are fetched.
- Backgrounds are created with CSS gradients, radial layers, transforms, opacity, and glass effects.
- `prefers-reduced-motion` disables theme animation.
- The selected cinematic theme is saved separately in `cavyre:cinematic-wave` so older Color Wave code cannot invalidate the new theme on reload.
- A runtime protection layer reapplies the selected cinematic theme if an older portal wave runtime attempts to reset it.

## Settings
A new APPEARANCE · COLOR WAVE panel is inserted into System Settings with four animated CSS preview cards. The cards themselves use no image assets.
