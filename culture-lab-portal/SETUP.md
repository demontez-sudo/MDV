# Set up the Culture Lab Casting database

The portal has its own database: a `culture_lab` schema in a new Supabase project, with one table for each kind of record. It starts empty. The only record created is the owner account, on the first sign-in.

## What is in the database

| Table | Holds |
|---|---|
| `settings` | Roles and permissions, automations, numbering, pitch availability, integrations |
| `staff` | Everyone with portal access, their role, team and MFA requirement |
| `productions` | Productions, seasons and season structure |
| `teams` | Producer teams for each season |
| `people` | One record per person, shared by leads and stories |
| `leads` | Scouting leads and their review status |
| `stories` | The 19-step story workspace: screening, background, pitch, interviews, media, cuts, One Sheet and network decision |
| `events` | Calendar: pitches, interviews, reviews, deadlines and meetings |
| `tasks` | Open and completed tasks |
| `notes` | Team notes, replies, follow-ups and to-dos |
| `notifications` | Each person's alerts |
| `activity` | The activity log |
| `automation_runs` | What each automation did and when |
| `deliveries` | Network deliveries and what was sent |
| `change_log` | Every saved change: who, which action and how many records |

Each table keeps the full record in `data`. The other columns, such as `stage`, `status`, `production_id` and `due_at`, are filled in automatically so the data can be searched and reported on. The database refuses a lead, team, story or delivery that points to a production that does not exist.

Two ready-made reports are included: `story_board` and `lead_pipeline`.

No browser can read these tables. Only the `culture-lab-api` function can, after it checks the person's sign-in, MFA and role.

## 1. Create the database
1. Create a new Supabase project for Culture Lab Casting.
2. In SQL Editor, run `supabase/sql/01_culture_lab_schema.sql`, then `supabase/sql/02_culture_lab_storage.sql`. Run each once. Run `03_culture_lab_schedule.sql` after step 2c.
3. In Database → Backups, turn on daily backups. Point-in-time recovery is recommended.

## 2. Add the server function
1. In Edge Functions, create a function named `culture-lab-api` and paste in `supabase/functions/culture-lab-api/index.ts`.
2. Leave "Verify JWT" off. The function checks every sign-in and MFA level itself.
3. Add these Edge Function secrets:
   - `CULTURE_LAB_OWNER_EMAIL`: the email the owner will sign in with
   - `CULTURE_LAB_OWNER_NAME`: the owner's full name, as it should appear in the portal
   - `CULTURE_LAB_PORTAL_URL`: the portal address, for example `https://portal.example.com`
   - `CULTURE_LAB_ALLOWED_ORIGINS`: the same portal address

## 2b. Turn on Lab Assistant (optional)
Lab Assistant turns meeting transcripts, conversations and rough notes into a clean note, tasks and calendar items, answers questions about the day, and gives progress briefings (stories by phase, what moved, what has stalled, overdue tasks, leads, deadlines and team workload). Progress only covers what the person's role can already see. In DaySilk, Plan my day proposes focus blocks between meetings; anyone with Notes can add focus blocks to their own day, even without calendar access. It only proposes: nothing is saved until the person ticks the items and presses Add. It uses Claude (model `claude-opus-5-5`, with Anthropic's automatic fallback if a request is declined).

1. Create an API key at console.anthropic.com under the account that will pay for usage, and set a monthly spend limit there.
2. Add it as an Edge Function secret named `ANTHROPIC_API_KEY`. Never put it in the site files.
3. Optional: `CULTURE_LAB_AI_MODEL` to use a different Claude model.
4. Redeploy `culture-lab-api` so it picks up the secret.

Without the key, Lab Assistant still works in basic mode, using simple rules to find tasks and dates. Each person can use it up to 60 times an hour. Meeting text is sent to Anthropic to be processed, so tell staff not to paste screening or background details they would not put in a note.

## 2c. Timed rules and file types
Reminders before due dates, escalation of overdue tasks to the production leads, stalled-story flags and repeating meetings run on a schedule, every 10 minutes, whether or not anyone is signed in. They also run when someone opens the portal. Each alert is sent once, and every run is recorded in Automations and in `change_log` as `system`.

1. Make a long random value (at least 32 characters) and add it as the Edge Function secret `CULTURE_LAB_CRON_SECRET`. Redeploy `culture-lab-api`.
2. Open `supabase/sql/03_culture_lab_schedule.sql`, put the same value where it says `PASTE-THE-CULTURE_LAB_CRON_SECRET-VALUE-HERE`, and run it in SQL Editor. It turns on `pg_cron` and `pg_net`, schedules the job `culture-lab-rules`, and limits the file types the storage bucket accepts.
3. To check it: SQL Editor, `select * from cron.job_run_details order by start_time desc limit 5;` shows each run.

Allowed uploads: video (MP4, MOV, M4V, WebM, up to 2 GB), audio (MP3, M4A, WAV, AAC, up to 500 MB), images (JPG, PNG, HEIC, WebP, GIF, up to 50 MB) and documents (PDF, Word, Excel, PowerPoint, text, CSV, RTF, up to 100 MB). The browser, the server and the storage bucket all enforce this. The Supabase Free plan caps every file at 50 MB, so larger video needs the Pro plan. Timing for each rule is set in Automations. Alerts appear in the portal's notifications; email delivery is not connected yet.

## 3. Configure sign-in
1. In Authentication, set the Site URL to the portal address and add it as a redirect URL.
2. Turn off public sign-ups. Staff join by invitation from Team & Access.
3. Turn on TOTP multifactor authentication.
4. Set up custom SMTP so invitation emails come from a Culture Lab Casting address.
5. Create the owner's user in Authentication with the `CULTURE_LAB_OWNER_EMAIL` address.

## 4. Connect the portal
Put the project URL and anon public key in `assets/culture-lab-config.js`, then deploy the site files to Netlify. Without them, the portal runs the sample-data preview and nothing is saved to the database.

## 5. Before go-live
- Sign in as the owner, set up MFA, then invite one person for each role and test their access.
- Test a backup restore.
- Add malware scanning for uploaded files.
- Have counsel review retention periods and any screening provider.
