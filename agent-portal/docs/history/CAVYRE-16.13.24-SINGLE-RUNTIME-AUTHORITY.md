# CAVYRE 16.13.24 — Single Runtime Authority

This release removes the active runtime collision that kept legacy Season and Orbit renderers visible.

- The shell no longer boots `veux-agent-v16.11.40-calendar-engine.js`.
- `cavyre-calendar-engine-16.13.24.js` is the sole Calendar engine loaded by the shell.
- Fashion Week data, Season renderer and Season guard are loaded sequentially by the authenticated shell, after Calendar authority and before navigation.
- Static duplicate Season loaders and the post-shell Calendar injector were removed.
- Literal `\n` corruption in the four HTML entrypoints was repaired.
- Existing legacy files remain archived but are not active runtime authorities.
- No Netlify deployment performed.
