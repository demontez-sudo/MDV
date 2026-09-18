# CAVYRE 16.15.00 — System Stabilization

This release is a stabilization baseline, not a feature redesign.

## Protected runtime boundaries
- Login / Agent boot: one required-asset manifest; every required asset must physically exist under `public/`.
- Calendar: pinned to the approved stable renderer lineage (`cavyre-calendar-engine-16.14.17.js`) plus `cavyre-calendar-authority-16.11.78.js`. Later volumetric replacement renderer is prohibited by the release gate.
- Tasks: `/api/agent/tasks/v11` remains canonical. Core task rows are now independent from optional related datasets; optional relationship failures degrade with warnings instead of returning a full 500. Status writes retain the canonical RPC and have a permission-verified recovery write path.
- Vera: canonical Vera release assets are restored in every serving mirror; legacy Vera official loader remains retired.
- Season / Fashion Week / Model Operating Web: existing canonical authorities are preserved; no new duplicate database or renderer introduced.
- Netlify publish authority remains `public/`.

## Full-system release gate
`tools/validate-cavyre-stable.py` verifies:
1. Netlify publishes `public/`.
2. Agent/root entrypoint static assets resolve.
3. Login/dynamic shell assets resolve.
4. Active Agent scripts are unique and parse successfully.
5. Core Agent API redirects point to real Netlify functions.
6. Approved Calendar renderer contract is present and replacement Calendar renderer is absent.
7. Known legacy Calendar/Vera authorities are not active.
8. Tasks v11 contains fail-soft reads and verified mutation recovery.

Additional audit performed for this package:
- 685 JavaScript files under `public/`: 0 syntax failures.
- 101 Netlify JavaScript/MJS functions: 0 syntax failures.
- Production Supabase schema verified for core Tasks, Calendar, Booking, Casting, Travel, Visa, Season, Models and supporting Task/Approval tables.
- Task RPCs verified present: `set_task_status_staff`, `create_staff_task`, `decide_approval_request`, `create_approval_request_staff`.

## Release discipline
Historical assets remain in the source package only where removing them without runtime telemetry could create risk. They are not automatically considered active. New releases must pass the stability gate before packaging. Login and Calendar are protected release boundaries and must not be version-renamed as collateral changes for unrelated features.
