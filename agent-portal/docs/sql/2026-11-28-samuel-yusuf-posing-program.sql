-- Samuel Yusuf: the four-week practice program from his Posing Handbook, as tasks in his 90-day gameplan.
-- Run in the MAISON DE VEUX Supabase project (SQL Editor). Safe to run again: each task has a key (metadata.gp_key), so a second run
-- only updates dates and wording and never duplicates a task or resets a status.
-- Needs: Samuel Yusuf already has his gameplan (run the 90-day gameplan SQL first).
-- Adds 9 tasks for Samuel: read the handbook, then for each of 4 weeks a daily-practice task (due Saturday) and the Sunday video.
-- They carry metadata.plan = 'g90', so the 90-day reminder job (24 hours, 2 hours, overdue) covers them like the rest of his plan.
-- To move the whole program, change v_start (it must be a Monday) and run again.

do $sp$
declare
  v_start date := date '2026-11-30';   -- Monday of Week 1
  v_tz text := 'Africa/Lagos';
  org uuid; boss uuid; mid uuid; gp uuid; tid uuid;
  w int; k text; ttl text; dsc text; due timestamptz; due_d date; ty text; hard boolean; lbl text;
  n_new int := 0; n_upd int := 0;
  focus text[] := array['Foundation','Angles and face','Pose library','Movement'];
  daily text[] := array[
    E'Every day, 20 to 30 minutes:\n- 5 min: S1 in the mirror, held for 60 seconds, three times\n- 5 min: lens lock with your phone camera, 30 seconds at a time\n- 5 min: the six hand positions from Chapter 4\n- 5 min: walk practice, 10 passes',
    E'Every day, 20 to 30 minutes:\n- 5 min: S1 warm-up\n- 10 min: S3, S4 and S5, moving between angles\n- 5 min: the three expression levels in the mirror\n- 5 min: walk with the stop and the turn',
    E'Every day, 20 to 30 minutes:\n- 5 min: S1 warm-up\n- 15 min: run through all 16 poses, three frames each\n- 5 min: a flow, linking five poses without stopping\n- 5 min: coat turn and flare',
    E'Every day, 20 to 30 minutes:\n- 15 min: full warm-up\n- 10 min: M1 to M4, five reps each, landing held\n- 5 min: a pose flow\n- Rest a day if your body needs it. Fatigue shows in your face.'];
  video text[] := array[
    'S1, a 30-second lens lock, and four walk passes.',
    'Front to profile in one slow turn, holding each angle, then the walk with a turn.',
    'A full 2-minute pose flow and the coat turn.',
    'Two jumps, two lunges, two pivots, then a 30-second still with a direct gaze.'];
begin
  select id into org from public.organizations where slug = 'maison-de-veux';
  if org is null then raise exception 'Organization maison-de-veux was not found'; end if;
  select id into boss from auth.users where lower(email) = 'demontez@maisondeveux.com';
  select id into mid from public.models
    where organization_id = org and lower(regexp_replace(trim(display_name), '\s+', ' ', 'g')) = 'samuel yusuf' limit 1;
  if mid is null then raise exception 'Samuel Yusuf was not found in Models'; end if;
  select id into gp from public.model_gameplans where organization_id = org and model_id = mid limit 1;
  if gp is null then raise exception 'Samuel Yusuf has no gameplan yet. Run the 90-day gameplan SQL first.'; end if;

  for w in 0..4 loop
    for k in select unnest(case when w = 0 then array['READ'] else array['P','V'] end) loop
      if w = 0 then
        ttl := 'Read your Posing Handbook, start to finish';
        dsc := E'Open My Gameplan, then Posing Handbook. Read all 14 chapters once, in order, before Week 1 practice starts. Chapter 9 lists the habits we saw in your Test #1, so start there if you are short on time.';
        due_d := v_start; ty := 'training'; hard := false;
      elsif k = 'P' then
        ttl := 'Posing Week ' || w || ' · ' || focus[w] || ': daily practice';
        dsc := daily[w] || E'\n\nTick this off at the end of the week once you have done the practice on most days.';
        due_d := v_start + (w - 1) * 7 + 5; ty := 'training'; hard := false;
      else
        ttl := 'Posing Week ' || w || ' · Sunday video';
        dsc := 'Send: ' || video[w] || E'\n\nFilm with your phone propped at chest height, full body in frame, in good daylight, wearing the black tank and trousers. Send it unedited. Upload it in Skin & Walks (Model walk): MP4 or MOV, under 50 MB, so film at 1080p rather than 4K. The agency replies with notes within 48 hours.';
        due_d := v_start + (w - 1) * 7 + 6; ty := 'progress_submission'; hard := false;
      end if;
      due := ((due_d + time '18:00') at time zone v_tz);
      lbl := trim(to_char(due_d, 'Dy Mon FMDD')) || ', 6:00 PM Lagos (12:00 PM ET)';
      select id into tid from public.tasks where organization_id = org and metadata->>'gp_key' = 'g90:samuel-yusuf:POSE-' || w || k limit 1;
      if tid is null then
        insert into public.tasks (organization_id, model_id, title, description, priority, due_at, category, status, visibility, created_by, metadata)
        values (org, mid, ttl, dsc, 'normal', due, ty, 'open', 'organization', boss,
                jsonb_build_object('gp_key', 'g90:samuel-yusuf:POSE-' || w || k, 'plan', 'g90', 'task_type', ty, 'is_hard_stop', hard, 'area', 'Posing',
                                   'owner_name', 'Samuel Yusuf', 'due_label', lbl, 'audience', 'model', 'gameplan_id', gp, 'handbook', 'posing-handbook'))
        returning id into tid;
        insert into public.task_assignments (organization_id, task_id, model_id, assignment_role, assigned_by)
        values (org, tid, mid, 'assignee', boss) on conflict do nothing;
        n_new := n_new + 1;
      else
        update public.tasks set title = ttl, description = dsc, due_at = due,
               metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('due_label', lbl, 'gameplan_id', gp), updated_at = now()
         where id = tid;
        n_upd := n_upd + 1;
      end if;
    end loop;
  end loop;

  raise notice 'Samuel Yusuf posing program: % tasks added, % updated. First task due %; last video due %.',
    n_new, n_upd, to_char(v_start, 'Dy Mon FMDD'), to_char(v_start + 27, 'Dy Mon FMDD');
end $sp$;

-- Check: should list 9 rows, oldest first.
select t.title, to_char(t.due_at at time zone 'Africa/Lagos', 'Dy Mon DD HH24:MI') as due_lagos, t.status
from public.tasks t
where t.metadata->>'gp_key' like 'g90:samuel-yusuf:POSE-%'
order by t.due_at;
