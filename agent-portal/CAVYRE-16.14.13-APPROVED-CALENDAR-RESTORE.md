# CAVYRE 16.14.13 — Approved Calendar Restore

This release restores the approved Calendar implementation rather than preserving the replacement Calendar renderer.

- Restores the pre-replacement 16.11.40 Calendar engine as the 16.14.13 Calendar runtime.
- Re-enables the approved 16.11.78 Permanent Calendar Design Authority in the actual served Agent entry point (`public/admin/index.html`) and mirrors.
- Preserves the existing `/api/agent/calendar/v9` data contract, drag/drop, model scope, event actions, Calendar intelligence drawer, and model calendar filtering.
- Removes the 16.13.x volumetric Orbit renderer from active Calendar ownership by no longer loading it as the current Calendar engine.
- Calendar remains a protected runtime boundary; unrelated feature releases must not replace its renderer or approved design authority.
- No Supabase migration. No authentication change. No Model Portal or MA Portal change.
