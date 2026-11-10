-- Takes Lance Valadie off the "Model Training / New Face" session on 5 Jan 2027 (16:00 UTC), which sits inside his Test shoot 2 (14:00-22:00).
-- The session stays for everyone else. Run once.
delete from public.event_models x
using public.events e, public.models m
where x.event_id = e.id and x.model_id = m.id
  and m.display_name = 'Lance Valadie'
  and e.title = 'Model Training / New Face'
  and e.starts_at = '2027-01-05 16:00:00+00';

select (select count(*) from public.event_models x join public.events e on e.id = x.event_id join public.models m on m.id = x.model_id
        where m.display_name = 'Lance Valadie' and e.title = 'Model Training / New Face' and e.starts_at = '2027-01-05 16:00:00+00') as lance_still_on_the_session,
       (select count(*) from public.event_models x join public.events e on e.id = x.event_id
        where e.title = 'Model Training / New Face' and e.starts_at = '2027-01-05 16:00:00+00') as people_left_on_the_session;
