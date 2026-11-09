# 90-day gameplan (Nov 8, 2026 to Feb 5, 2027)

One generator makes everything from a single source, so the spreadsheet, the SQL and the portals never disagree.

```
python3 -m venv .venv && .venv/bin/pip install openpyxl
.venv/bin/python build_all.py        # writes ./out/*.sql and ./out/MDV-90-Day-Gameplan-2026-11-08.xlsx
```

## Where to change things
| Change | File |
|---|---|
| Models, bases, shows, agents, visa status | `roster.py` |
| Travel rates, itineraries | `travel.py` (rates are estimates until Troy loads quotes) |
| Every model deadline, test shoot dates, visa dates | `plan.py` |
| Demontez's own tasks, events, body targets | `owner.py` |
| Skin, fueling, walk and health text | `wellness.py` |

## Run order in the Supabase SQL editor (MAISON DE VEUX project)
1. `docs/sql/2026-11-08-gameplan-0-demontez-daysilk.sql` (open DaySilk once first)
2. `...-1-models-1-of-4.sql` to `...-4-models-4-of-4.sql` (any order)
3. `...-5-team-and-alerts.sql` (last)

Every file is safe to run twice. Rows made by the plan carry `metadata.gp_key`, so a second run updates dates and text and never duplicates a row or resets a status.

## How the three portals line up
- **Agent portal:** tasks for Emma, Erica, Troy and Sophia (Tasks board), owner decisions stay in Demontez's DaySilk.
- **Model portal:** a Gameplan per model (existing active gameplans are kept) with the model's tasks, plus calendar events for DaySilk (skin submissions, walk videos, health due dates, test shoots, digitals, visa day, arrival).
- **Mother agency portal:** tasks shared with the model's active placement (`partner_shared`) and a notification for everyone linked to that agency in `partner_user_links`. Models with no placement on file get none.
- **Model DaySilk routine:** snack and water blocks, Tue/Thu walk or pose practice, a Sunday check-in and four habits are written to `model_private_profiles.metadata.daysilk.gameplan`. `model-portal/public/assets/mdv-model-daysilk.js` merges them into the display (`withGp`), so the model's own plan and re-saving their answers are never touched. They run to Feb 5.
- Staff-only tasks deliberately carry no `model_id`, because the model portal returns every task that has the model's id.

## Alerts
`netlify/functions/agent-gameplan-reminders.mjs` runs every 15 minutes: 24 hours before a deadline, 2 hours before a hard stop, 1 hour after a miss (hard stops also go to the owner of the company), and a Monday 8:00 AM ET week-ahead summary. Mother agency users get the same alerts. Push needs the VAPID keys; in-app notifications work without them.
