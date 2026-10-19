-- Lets editorial and press activity be recorded in the CRM ledger.
-- Why: saving a blog story writes an "editorial" line to crm_activity, and logging press writes "press", but the table's
-- activity_type check only allows email, call, meeting, package, casting, option, booking, invoice, payment, note, follow_up and other.
-- Result before this: "new row for relation crm_activity violates check constraint crm_activity_activity_type_check" when saving a story.
-- Run once in the Supabase SQL editor. Safe to run again. It keeps every value already allowed and adds the five below.

do $$
declare
  con record;
  newdef text;
  w text;
  want text[] := array['editorial', 'press', 'announcement', 'media', 'pr'];
  arrays int;
  changed boolean := false;
begin
  for con in
    select c.conname, pg_get_constraintdef(c.oid) as def
    from pg_constraint c
    where c.conrelid = 'public.crm_activity'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%activity_type%'
  loop
    newdef := con.def;
    arrays := (length(newdef) - length(replace(newdef, 'ARRAY[', ''))) / length('ARRAY[');
    if arrays <> 1 then
      raise notice 'Constraint % has an unexpected shape, left unchanged: %', con.conname, con.def;
      continue;
    end if;
    foreach w in array want loop
      if position('''' || w || '''' in newdef) = 0 then
        newdef := replace(newdef, 'ARRAY[', 'ARRAY[''' || w || '''::text, ');
        changed := true;
      end if;
    end loop;
    if newdef <> con.def then
      execute format('alter table public.crm_activity drop constraint %I, add constraint %I %s', con.conname, con.conname, newdef);
      raise notice 'Updated %: now %', con.conname, newdef;
    end if;
  end loop;
  if not changed then
    raise notice 'Nothing to change: editorial, press, announcement, media and pr are already allowed (or the constraint was not found).';
  end if;
end $$;

-- Check: this should list the new values.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.crm_activity'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%activity_type%';
