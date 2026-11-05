-- Copy ONE person's existing DaySilk (from the original DaySilk project) into their DaySilk in the Maison de Veux portal.
-- Works for the DaySilk business app. (The personal "The Rebuild" app keeps its data in rebuild_docs in a different format; leave that at /me/.)
-- Do this AFTER they have opened DaySilk once in the portal, so their portal account exists.

-- STEP 1. Run this in the ORIGINAL DaySilk Supabase project. Copy the single result cell.
--   select jsonb_agg(jsonb_build_object('doc_id', doc_id, 'data', data))
--   from public.daysilk_docs
--   where user_id = (select id from auth.users where lower(email) = 'demontez@maisondeveux.com');

-- STEP 2. Run this in the MAISON DE VEUX Supabase project. Replace PASTE_JSON_HERE with the copied value and set the email.
insert into public.daysilk_docs (user_id, doc_id, data)
select (select id from auth.users where lower(email) = 'demontez@maisondeveux.com'), x->>'doc_id', x->'data'
from jsonb_array_elements($json$PASTE_JSON_HERE$json$::jsonb) as x
on conflict (user_id, doc_id) do update set data = excluded.data;
