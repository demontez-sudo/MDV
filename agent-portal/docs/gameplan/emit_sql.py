"""SQL emitters: Demontez's DaySilk (rebuild_docs) and the portal load (gameplans, tasks, events, notifications)."""
import json
from calc import *
from roster import MODELS, SHOWS

IANA = {"ET": "America/New_York", "WAT": "Africa/Lagos", "CET": "Europe/Paris", "GMT": "Europe/London",
        "MX": "America/Mexico_City", "KST": "Asia/Seoul", "PET": "America/Lima", "IST": "Asia/Kolkata"}
PLAN_TITLE = "90-Day Gameplan: Nov 8, 2026 to Feb 5, 2027"


def jd(o):
    s = json.dumps(o, ensure_ascii=False, separators=(",", ":"))
    assert "$json$" not in s
    return s


# ---------------------------------------------------------------------------- Demontez's DaySilk
def boss_sql(tasks, events):
    p = jd({"tasks": tasks, "events": events})
    return f"""-- Demontez's 90-day gameplan in DaySilk (The Rebuild): Nov 8, 2026 to Feb 5, 2027.
-- Run once in the MAISON DE VEUX Supabase project (SQL Editor). Open DaySilk once first so your account has saved data.
-- Safe to run again: items made by this plan (ids start with g90-) are replaced, and anything you already checked off stays checked.
-- Adds {len(tasks)} tasks and {len(events)} calendar events, and sets your weight goal to 210 lb.
-- Nothing else in your DaySilk is touched.

do $$
declare
  uid uuid;
  c jsonb;
  p jsonb := $json${p}$json$;
begin
  select id into uid from auth.users where lower(email) = 'demontez@maisondeveux.com';
  if uid is null then raise exception 'No portal login found for demontez@maisondeveux.com'; end if;
  select data into c from public.rebuild_docs where user_id = uid and doc_id = 'core';
  if c is null then raise exception 'Open DaySilk once in the portal, then run this again'; end if;

  -- tasks: keep other tasks, replace g90 tasks, keep done / subtask ticks of g90 tasks you already worked on
  c := jsonb_set(c, '{{tasks}}',
    coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(c->'tasks', '[]'::jsonb)) x
              where coalesce(x->>'id', '') not like 'g90-%'), '[]'::jsonb)
    || coalesce((select jsonb_agg(
         case when o.o is null then n.n
              else n.n || jsonb_build_object('done', coalesce(o.o->'done', 'false'::jsonb),
                                             'subs', case when jsonb_array_length(coalesce(o.o->'subs', '[]'::jsonb)) = jsonb_array_length(n.n->'subs') then o.o->'subs' else n.n->'subs' end)
         end)
       from jsonb_array_elements(p->'tasks') n(n)
       left join lateral (select x as o from jsonb_array_elements(coalesce(c->'tasks', '[]'::jsonb)) x where x->>'id' = n.n->>'id' limit 1) o on true), '[]'::jsonb),
    true);

  -- events: replace g90 events
  c := jsonb_set(c, '{{events}}',
    coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(c->'events', '[]'::jsonb)) x
              where coalesce(x->>'id', '') not like 'g90-%'), '[]'::jsonb)
    || (p->'events'),
    true);

  -- weight goal 210 (start stays what it was; 225 if none)
  c := jsonb_set(c, '{{body}}', coalesce(c->'body', '{{}}'::jsonb) || jsonb_build_object('goal', 210), true);

  update public.rebuild_docs set data = c where user_id = uid and doc_id = 'core';
end $$;

-- Check: your total tasks and events, and how many came from this plan.
select jsonb_array_length(data->'tasks') as tasks,
       (select count(*) from jsonb_array_elements(data->'tasks') x where x->>'id' like 'g90-%') as plan_tasks,
       jsonb_array_length(data->'events') as events,
       (select count(*) from jsonb_array_elements(data->'events') x where x->>'id' like 'g90-%') as plan_events,
       data->'body'->>'goal' as weight_goal
from public.rebuild_docs
where doc_id = 'core' and user_id = (select id from auth.users where lower(email) = 'demontez@maisondeveux.com');
"""


# ---------------------------------------------------------------------------- the portal load
def slim(r, hide_model=False):
    o = dict(i=r["id"], a=r["audience"], o=r["owner"], t=r["title"], d=r["desc"], u=r["utc"],
             k="t" if r["kind"] == "task" else "e", ty=(r["ttype"] if r["kind"] == "task" else r["etype"]),
             h=bool(r["hard"]), ar=r["area"], z=IANA[r["tz"]], w=r["when"])
    if r["kind"] == "event":
        o["en"] = iso_utc(r["day"], r["end"], r["tz"]) if r.get("end") else None
        o["loc"] = r.get("location")
        o["ek"] = r.get("event_kind") or ""
    if r.get("models"):
        o["ms"] = r["models"]
    if r.get("amount"):
        o["amt"] = r["amount"]
    return o


def gp_fields(m):
    runway = m["kind"] == "runway"
    shows = "; ".join(f"{SHOWS[s][0]} ({short_date(SHOWS[s][1])} to {short_date(SHOWS[s][2])})" for s in m["shows"]) if runway else ""
    risks = []
    if m["visa"] == "schengen":
        risks.append("Schengen visa must be filed by Nov 13 and decided by Dec 21. No decision means a same-day fallback plan.")
    if m["visa"] in ("us_o1", "us"):
        risks.append("US work visa must be in the passport by Jan 22 for NYFW. Legal fee is quoted separately.")
    if m["visa"] in ("check_us", "check_eu"):
        risks.append("Work-permit / entry status is being confirmed by Nov 13.")
    if m["milan"]:
        risks.append("May sign in Milan. Decision Dec 4 changes the visa country and adds a Milan leg (Jan 15 to 19).")
    if m["minor"]:
        risks.append("Under 18: guardian at every session and flight, school hours first, no weight or measurement targets, work permits confirmed before travel.")
    if m["note"]:
        risks.append(m["note"])
    return dict(
        title=PLAN_TITLE,
        key_date=(m["first_show"] if runway else d("2027-03-15")).isoformat(),
        key_label=(SHOWS[[s for s in m["shows"] if SHOWS[s][1] == m["first_show"]][0]][0] if runway else "Spring editorial window opens"),
        welcome=(f"Welcome to your 90-day gameplan, {m['first']}. Every task has a date and a time in your own time zone. "
                 f"Tap Complete when a task is done, or request a new date with a note. Your agent is {m['agent']}."),
        positioning=(f"Runway: {shows}." if runway else "Editorial and print focus this season. No runway push."),
        market=f"Base: {m['base']}. " + (f"Shows: {', '.join(m['showlist'])}." if runway else "Editorial and campaign bookings; spring window opens Mar 15."),
        image_rules=("Test shoots: " + ("1" if m["tests"] == 1 else "2") + " in this block. Fresh digitals close to your first show. "
                     "Skin photos four times (Nov 16, Dec 14, pre-show, Feb 1). Nothing is posted or sent without your approval of the selects."),
        risks=" ".join(risks),
        cadence={"daily": "Skin routine morning and night, food and water, sleep 8 hours", "walk": "Tuesday and Thursday 30 minutes" if runway else "Pose practice, two check dates",
                 "weekly": "Sunday wellness check-in with your agent", "deadlines": "All dates and times are in your gameplan tasks"},
    )


def ds_fields(m):
    """Routine blocks, habits and weekly items that sit beside a model's own DaySilk plan (never overwrite it)."""
    runway = m["kind"] == "runway"
    all_days = ["0", "1", "2", "3", "4", "5", "6"]
    blocks = [
        dict(id="gp_snack1", days=all_days, start="10:30", end="10:45", title="Snack + water (fueling plan)", cat="meal", until="2027-02-05"),
        dict(id="gp_snack2", days=all_days, start="15:30", end="15:45", title="Snack + water (fueling plan)", cat="meal", until="2027-02-05"),
        dict(id="gp_walk", days=["2", "4"], start="18:00", end="18:30", title="Walk practice (gameplan)" if runway else "Pose practice (gameplan)",
             cat="model", until="2027-02-05"),
        dict(id="gp_checkin", days=["0"], start="17:00", end="17:20", title="Sunday wellness check-in with your agent", cat="routine", until="2027-02-05"),
    ]
    habits = [
        dict(id="gp_skin", label="Skin plan from your gameplan: morning and night"),
        dict(id="gp_fuel", label="Fueling plan: protein at every meal, two snacks, water"),
        dict(id="gp_walk", label="Walk practice Tuesday and Thursday" if runway else "Pose practice Tuesday and Thursday"),
        dict(id="gp_sleep", label="Sleep %s hours" % ("9" if m["minor"] else "8")),
    ]
    weekly = [dict(k="gp_dates", t="Open your gameplan: skin photos, walk videos, health checks and test shoots each have a set date and time")]
    if runway:
        weekly.append(dict(k="gp_walkvid", t="Walk video due dates: Nov 23, Dec 14 and your pre-show date"))
    return dict(built="2026-11-08", until="2027-02-05", blocks=blocks, habits=habits, weekly=weekly)


PRELUDE = r"""-- {title}
-- Run in the MAISON DE VEUX Supabase project (SQL Editor). Safe to run again: every row made by this plan has a key
-- (metadata.gp_key), so a second run updates dates and text and never duplicates or resets a status.
-- Needs: the team names Emma, Erica, Troy and Sophia as active staff with a display name (first name matched).
-- Models are matched by name. Anyone not found is listed in the Messages tab as a NOTICE and skipped.

create or replace function pg_temp.nm(t text) returns text language sql immutable as $f$
  select coalesce(string_agg(x, ' ' order by x), '')
  from unnest(regexp_split_to_array(lower(regexp_replace(trim(coalesce(t, '')), '[^a-zA-Z0-9 ]', '', 'g')), '\s+')) x
$f$;

create or replace function pg_temp.gp_item(org uuid, boss uuid, mid uuid, gp uuid, pa uuid, it jsonb, mem jsonb)
returns text language plpgsql as $f$
declare
  tid uuid; eid uuid; own text; mm uuid; v_model uuid; v_partner uuid; v_vis text; v_meta jsonb; prio text;
  aud text := it->>'a';
begin
  if it->>'k' = 't' then
    if aud = 'partner' and pa is null then return 'skip:nopartner'; end if;
    prio := case when (it->>'h')::boolean then 'high' else 'normal' end;
    v_model := case when aud = 'model' then mid else null end;
    v_partner := case when aud = 'partner' then pa else null end;
    v_vis := case when aud = 'partner' then 'partner_shared' else 'organization' end;
    v_meta := jsonb_build_object('gp_key', it->>'i', 'plan', 'g90', 'task_type', it->>'ty', 'is_hard_stop', (it->>'h')::boolean,
                                 'area', it->>'ar', 'owner_name', it->>'o', 'due_label', it->>'w', 'audience', aud);
    if aud = 'model' then v_meta := v_meta || jsonb_build_object('gameplan_id', gp); end if;
    if it ? 'amt' then v_meta := v_meta || jsonb_build_object('approval_amount', it->'amt'); end if;
    if it ? 'ms' then v_meta := v_meta || jsonb_build_object('models', it->'ms'); end if;
    select id into tid from public.tasks where organization_id = org and metadata->>'gp_key' = it->>'i' limit 1;
    if tid is null then
      insert into public.tasks (organization_id, model_id, partner_agency_id, title, description, priority, due_at, category, status, visibility, created_by, metadata)
      values (org, v_model, v_partner, it->>'t', it->>'d', prio, (it->>'u')::timestamptz, it->>'ty', 'open', v_vis, boss, v_meta)
      returning id into tid;
      if aud = 'model' then
        insert into public.task_assignments (organization_id, task_id, model_id, assignment_role, assigned_by) values (org, tid, mid, 'assignee', boss) on conflict do nothing;
      elsif aud = 'staff' then
        own := lower(split_part(it->>'o', ' ', 1));
        if mem ? own then
          insert into public.task_assignments (organization_id, task_id, member_id, assignment_role, assigned_by) values (org, tid, (mem->>own)::uuid, 'assignee', boss) on conflict do nothing;
        else
          return 'task:nomember:' || own;
        end if;
      end if;
    else
      update public.tasks set title = it->>'t', description = it->>'d', priority = prio, due_at = (it->>'u')::timestamptz, category = it->>'ty',
             metadata = coalesce(metadata, '{}'::jsonb) || v_meta, updated_at = now()
      where id = tid;
    end if;
    return 'task';
  elsif it->>'k' = 'e' then
    v_meta := jsonb_build_object('gp_key', it->>'i', 'plan', 'g90', 'category', it->>'ar', 'event_kind', it->>'ek', 'calendar_event_type', it->>'ty');
    select id into eid from public.events where organization_id = org and metadata->>'gp_key' = it->>'i' limit 1;
    if eid is null then
      insert into public.events (organization_id, title, event_type, status, starts_at, ends_at, timezone, all_day, location, visibility, notes, metadata)
      values (org, it->>'t', it->>'ty', 'scheduled', (it->>'u')::timestamptz, nullif(it->>'en', '')::timestamptz, it->>'z', false, it->>'loc', 'model_shared', it->>'d', v_meta)
      returning id into eid;
    else
      update public.events set title = it->>'t', event_type = it->>'ty', starts_at = (it->>'u')::timestamptz, ends_at = nullif(it->>'en', '')::timestamptz,
             timezone = it->>'z', location = it->>'loc', notes = it->>'d', metadata = coalesce(metadata, '{}'::jsonb) || v_meta, updated_at = now()
      where id = eid;
    end if;
    insert into public.event_models (organization_id, event_id, model_id) values (org, eid, mid) on conflict do nothing;
    return 'event';
  end if;
  return 'skip';
end $f$;
"""

MODEL_BLOCK = r"""
do $gp$
declare
  p jsonb := $json${payload}$json$;
  org uuid; boss uuid; mem jsonb := '{{}}'::jsonb;
  m jsonb; it jsonb; mid uuid; gp uuid; dp uuid; pa uuid; st text; r text;
  n_models int := 0; n_task int := 0; n_event int := 0; n_skip int := 0;
  miss text := ''; nomem text := ''; pmeta jsonb; ppfound boolean; n_ds int := 0;
begin
  select id into org from public.organizations where slug = 'maison-de-veux';
  if org is null then raise exception 'Organization maison-de-veux was not found'; end if;
  select id into boss from auth.users where lower(email) = 'demontez@maisondeveux.com';
  select coalesce(jsonb_object_agg(k, v), '{{}}'::jsonb) into mem from (
    select lower(split_part(pr.display_name, ' ', 1)) k, om.id::text v
    from public.organization_members om join public.profiles pr on pr.user_id = om.user_id
    where om.organization_id = org and om.member_type = 'staff' and om.status = 'active') s;

  for m in select * from jsonb_array_elements(p->'models') loop
    select id into mid from public.models where organization_id = org and pg_temp.nm(display_name) = pg_temp.nm(m->>'name') limit 1;
    if mid is null then miss := miss || (m->>'name') || '; '; continue; end if;
    n_models := n_models + 1;

    select id, development_plan_id, status into gp, dp, st from public.model_gameplans where organization_id = org and model_id = mid limit 1;
    if gp is null then
      insert into public.model_gameplans (organization_id, model_id, status, title, key_date, key_date_label, welcome_message, brand_positioning, market_focus, image_rules, risks, checkin_cadence, created_by)
      values (org, mid, 'active', m->'gp'->>'title', (m->'gp'->>'key_date')::date, m->'gp'->>'key_label', m->'gp'->>'welcome', m->'gp'->>'positioning',
              m->'gp'->>'market', m->'gp'->>'image_rules', m->'gp'->>'risks', m->'gp'->'cadence', boss)
      returning id into gp;
      dp := null;
    else
      update public.model_gameplans set status = 'active',
             title = coalesce(title, m->'gp'->>'title'), key_date = coalesce(key_date, (m->'gp'->>'key_date')::date),
             key_date_label = coalesce(key_date_label, m->'gp'->>'key_label'), welcome_message = coalesce(welcome_message, m->'gp'->>'welcome'),
             brand_positioning = coalesce(brand_positioning, m->'gp'->>'positioning'), market_focus = coalesce(market_focus, m->'gp'->>'market'),
             image_rules = coalesce(image_rules, m->'gp'->>'image_rules'), risks = coalesce(risks, m->'gp'->>'risks'), updated_at = now()
      where id = gp;
    end if;
    if dp is null then
      insert into public.development_plans (organization_id, model_id, title, status, starts_on, target_date, summary, metadata)
      values (org, mid, m->'gp'->>'title', 'active', date '2026-11-08', (m->'gp'->>'key_date')::date, m->'gp'->>'positioning',
              jsonb_build_object('source', 'smart_gameplan', 'gameplan_id', gp, 'plan', 'g90'))
      returning id into dp;
      update public.model_gameplans set development_plan_id = dp where id = gp;
    end if;

    -- daily routine blocks, habits and weekly items for the model's own DaySilk (kept beside their plan, so re-saving their answers never removes them)
    -- model_private_profiles has no id column: a row is identified by organization_id + model_id
    select metadata into pmeta from public.model_private_profiles where organization_id = org and model_id = mid limit 1;
    ppfound := found;
    pmeta := jsonb_set(coalesce(pmeta, '{{}}'::jsonb), '{{daysilk}}', coalesce(pmeta->'daysilk', '{{}}'::jsonb) || jsonb_build_object('gameplan', m->'ds'), true);
    if not ppfound then
      insert into public.model_private_profiles (organization_id, model_id, metadata) values (org, mid, pmeta);
    else
      update public.model_private_profiles set metadata = pmeta where organization_id = org and model_id = mid;
    end if;
    n_ds := n_ds + 1;

    select partner_agency_id into pa from public.model_placements
      where organization_id = org and model_id = mid and status in ('active', 'pending', 'placed') order by created_at desc limit 1;

    for it in select * from jsonb_array_elements(m->'items') loop
      r := pg_temp.gp_item(org, boss, mid, gp, pa, it, mem);
      if r = 'task' then n_task := n_task + 1;
      elsif r = 'event' then n_event := n_event + 1;
      elsif r like 'task:nomember:%' then n_task := n_task + 1; nomem := nomem || substr(r, 15) || ' ';
      else n_skip := n_skip + 1; end if;
    end loop;
  end loop;

  raise notice 'Models loaded: %. Tasks: %. Calendar events: %. DaySilk routine blocks written for: %. Skipped (no mother agency placement on file): %.', n_models, n_task, n_event, n_ds, n_skip;
  if miss <> '' then raise notice 'Models NOT found by name (fix the name in Models and run again): %', miss; end if;
  if nomem <> '' then raise notice 'Team names with no matching active staff (first names): %', (select string_agg(distinct x, ', ') from unnest(string_to_array(trim(nomem), ' ')) x); end if;
end $gp$;
"""

TEAM_BLOCK = r"""
do $gp$
declare
  p jsonb := $json${payload}$json$;
  org uuid; boss uuid; mem jsonb := '{{}}'::jsonb; memu jsonb := '{{}}'::jsonb;
  it jsonb; r text; n_task int := 0; nomem text := ''; mk text; uid uuid; cnt int; nxt text; n_note int := 0; l record;
begin
  select id into org from public.organizations where slug = 'maison-de-veux';
  if org is null then raise exception 'Organization maison-de-veux was not found'; end if;
  select id into boss from auth.users where lower(email) = 'demontez@maisondeveux.com';
  select coalesce(jsonb_object_agg(k, v), '{{}}'::jsonb), coalesce(jsonb_object_agg(k, u), '{{}}'::jsonb) into mem, memu from (
    select lower(split_part(pr.display_name, ' ', 1)) k, om.id::text v, om.user_id::text u
    from public.organization_members om join public.profiles pr on pr.user_id = om.user_id
    where om.organization_id = org and om.member_type = 'staff' and om.status = 'active') s;

  for it in select * from jsonb_array_elements(p->'team') loop
    r := pg_temp.gp_item(org, boss, null, null, null, it, mem);
    if r like 'task%' then n_task := n_task + 1; end if;
    if r like 'task:nomember:%' then nomem := nomem || substr(r, 15) || ' '; end if;
  end loop;

  -- tell each team member the plan is live (once)
  for mk in select jsonb_object_keys(memu) loop
    uid := (memu->>mk)::uuid;
    select count(*) into cnt from public.tasks t join public.task_assignments a on a.task_id = t.id
      where t.organization_id = org and t.metadata->>'plan' = 'g90' and a.member_id = (mem->>mk)::uuid and t.status <> 'completed';
    if cnt > 0 and not exists (select 1 from public.notifications where user_id = uid and notification_type = 'gameplan_live_g90') then
      select to_char(min(t.due_at at time zone 'America/New_York'), 'Dy Mon DD, HH12:MI AM') into nxt from public.tasks t join public.task_assignments a on a.task_id = t.id
        where t.organization_id = org and t.metadata->>'plan' = 'g90' and a.member_id = (mem->>mk)::uuid and t.status <> 'completed';
      insert into public.notifications (organization_id, user_id, notification_type, title, body, channel, status)
      values (org, uid, 'gameplan_live_g90', '90-day gameplan is live', 'You own ' || cnt || ' deadlines. The first is ' || nxt || ' ET. Open Tasks to see every date and time.', 'in_app', 'delivered');
      n_note := n_note + 1;
    end if;
  end loop;

  -- tell each model with a portal login (once)
  for l in select mu.user_id, mu.model_id from public.model_user_links mu where mu.organization_id = org loop
    if exists (select 1 from public.tasks t where t.organization_id = org and t.model_id = l.model_id and t.metadata->>'plan' = 'g90')
       and not exists (select 1 from public.notifications where user_id = l.user_id and notification_type = 'gameplan_live_g90') then
      insert into public.notifications (organization_id, user_id, notification_type, title, body, channel, status)
      values (org, l.user_id, 'gameplan_live_g90', 'Your 90-day gameplan is ready', 'Open Gameplan to see every task with its date and time. Your skin plan, fueling plan, walk practice, health checks, test shoots and travel are in it.', 'in_app', 'delivered');
      n_note := n_note + 1;
    end if;
  end loop;

  -- tell each mother agency (everyone linked to the agency in partner_user_links), once
  for l in select pl.user_id, pl.partner_agency_id from public.partner_user_links pl where pl.organization_id = org loop
    select count(*), to_char(min(t.due_at at time zone 'America/New_York'), 'Dy Mon DD, HH12:MI AM') into cnt, nxt from public.tasks t
      where t.organization_id = org and t.metadata->>'plan' = 'g90' and t.partner_agency_id = l.partner_agency_id and t.status <> 'completed';
    if cnt > 0 and not exists (select 1 from public.notifications where user_id = l.user_id and notification_type = 'gameplan_live_g90') then
      insert into public.notifications (organization_id, user_id, notification_type, title, body, channel, status)
      values (org, l.user_id, 'gameplan_live_g90', '90-day gameplan: ' || cnt || ' tasks for your agency',
              'Your models'' season plan is live. The first deadline is ' || nxt || ' ET. Open Tasks to confirm placements, visa letters, travel advances and test shoot approvals.', 'in_app', 'delivered');
      n_note := n_note + 1;
    end if;
  end loop;

  raise notice 'Team tasks: %. Notifications sent: %.', n_task, n_note;
  if nomem <> '' then raise notice 'Team names with no matching active staff (first names): %', (select string_agg(distinct x, ', ') from unnest(string_to_array(trim(nomem), ' ')) x); end if;
end $gp$;
"""


def portal_sql_files(rows):
    by_model = {}
    team = []
    for r in rows:
        (by_model.setdefault(r["model"], []) if r["model"] else team).append(r)
    models = sorted(MODELS, key=lambda m: m["name"])
    chunks = [models[i::4] for i in range(4)]
    files = []
    for ci, ch in enumerate(chunks, 1):
        payload = {"models": [dict(name=m["name"], gp=gp_fields(m), ds=ds_fields(m), items=[slim(r) for r in by_model[m["name"]]]) for m in ch]}
        sql = (PRELUDE.replace("{title}", f"{PLAN_TITLE}: models part {ci} of 4")
               + MODEL_BLOCK.format(payload=jd(payload)))
        files.append((f"2026-11-08-gameplan-{ci}-models-{ci}-of-4.sql", sql))
    team_items = [slim(r) for r in team if r["owner"] != "Demontez"]
    files.append(("2026-11-08-gameplan-5-team-and-alerts.sql",
                  PRELUDE.replace("{title}", f"{PLAN_TITLE}: team tasks and alerts (run this LAST)") + TEAM_BLOCK.format(payload=jd({"team": team_items}))))
    return files
