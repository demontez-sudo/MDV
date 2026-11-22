# Culture Lab Casting Portal

Private production portal for Culture Lab Casting, powered by Cavyre. It has its own database: the `culture_lab` schema in Supabase.

- `index.html`: the portal
- `assets/culture-store.js`: records, permissions and workflow rules, shared by the browser and the server
- `assets/culture-remote.js`: connects the portal to the database through the server function
- `assets/portal-assist.js`: Lab Assistant, which turns meetings and notes into tasks, calendar items and clean notes, and gives progress briefings from `progressSnapshot` in the store. Claude runs on the server; nothing is saved until the person approves it.
- `assets/portal-daysilk.js`: DaySilk, the personal day planner: one timeline of meetings, tasks and focus blocks, Plan my day through Lab Assistant, and an end-of-day wrap. It uses the portal's own calendar, tasks and notes.
- `assets/portal-tasks.js`: Tasks (priority, tasks that wait on other tasks) and Approvals (every decision waiting on the signed-in person).
- `assets/culture-lab-config.js`: Supabase project URL and anon key. Leave blank for the sample-data preview.
- `server/`: API source, function build script and local preview server
- `tests/api.test.mjs`: 236 tests that run the real server code against an in-memory Postgres. Run `npm install` once, then `npm test`.
- `supabase/sql/`: database schema and file storage
- `supabase/functions/culture-lab-api/`: the generated server function

Run `node server/dev.mjs 4191` to preview. Set the browser cookie `clsample=1` to preview with sample data instead of the live database. After changing `assets/culture-store.js` or `server/`, run `node server/build-function.mjs`.
See `SETUP.md` to create the database and go live.
