# Calendar audit, 9 Nov 2026

Scope: every calendar write path (create, update, move, delete for events), plus how Agenda, Orbit, Month, DaySilk and the model portal read the same events.

## Tested (31 end-to-end checks, 8 delete edge cases, 6 edit-type cases, all passing)
Create with validation, update with read-back, replacing attached models, move with linked task, delete (including the linked task surviving as detached, imported events recorded as skips, permission refusal, already-deleted).

## Fixed in this pass
1. Editing a Stay, Visa, Deadline, Press, Personal, Bookout, Hold, Job, Callback or Option event showed it as "Meeting" and saved it back as `meeting`. The form now keeps the real type.
2. Moving an event did not move its linked meeting task and gave no confirmation. It now moves the task and verifies the new time was stored.
3. Deleting an event that was already gone returned a confusing 409. It now reports success (`already_gone`).
4. (Earlier, same branch) Delete no longer stops on an optional clean-up table or column that is missing, and says why when it is blocked. Every open view refreshes after a save or delete.

## Known gaps (not changed)
- **Multi-day events** (stays, trips, multi-day shoots): fixed on 9 Nov. The calendar now returns events that began earlier but are still running, and the Agenda, Orbit and DaySilk show them on every day they cover (continuation days are labelled "day 2 of 11", open the original, and cannot be dragged). Period totals count each real event once. Not changed: the model portal's own calendar, and the Month (Season Matrix) view, which lists by model rather than by day.
- `Option 1/2/3` and `Task` form types are stored as `other`.
- Moving an event does not move availability blocks that came from it.
- DaySilk copies of agency and model events are read-only by design.
- Older drag handlers (v16.8.6, v16.8.7, v16.9) are still loaded alongside the current one; a double handled drop has not been reproduced.
- Booking and casting paths were only read, not exercised.

## Live data check
Run `docs/sql/2026-11-09-calendar-integrity-scan.sql` in the Supabase SQL editor. It is read-only and returns one scorecard (20 rows). Anything marked `problem` with found above 0 is worth a look.
