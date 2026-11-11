-- Email formats: saved emails the team can reuse (brand intro, casting submission, follow-ups, scouting approach ...).
-- Safe to run more than once. Adds a table and nine starter formats; it never changes existing data.

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  name text not null,
  situation text not null default 'other',
  audience text not null default 'any',
  subject text not null default '',
  body text not null default '',
  active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.email_templates enable row level security;   -- only the server (service role) reads and writes it
create unique index if not exists email_templates_org_name_uidx on public.email_templates (organization_id, lower(name));
create index if not exists email_templates_org_active_idx on public.email_templates (organization_id, active, sort_order);

-- Starter formats for Maison de Veux (skipped if a format with the same name already exists).
insert into public.email_templates (organization_id, name, situation, audience, subject, body, sort_order)
select o.id, v.name, v.situation, v.audience, v.subject, v.body, v.sort_order
from public.organizations o
cross join (values
 ('Brand introduction', 'intro', 'brand', $s${{agency.name}} x {{company.name}}$s$,
  $b$Hi {{contact.first_name|there}},

I'm {{agent.first_name}} at {{agency.name}}. We represent a roster of new and established faces, and I think a few of them would suit {{company.name}}.

If it helps, I can put together a short selection for your next campaign, lookbook or show. Tell me what you are casting for and your timing, and I will send options that fit.

Best,
{{agent.first_name}}$b$, 10),
 ('Pitch a model to a brand', 'submission', 'brand', $s${{model.name}} for {{company.name}}$s$,
  $b$Hi {{contact.first_name|there}},

I'm {{agent.first_name}} at {{agency.name}}. I wanted to put {{model.name}} in front of you for {{company.name}}.

{{model.measurements}}
Profile: {{model.profile_link}}

I can send a full package with digitals and recent work, and we can work around your dates. Would you like me to?

Best,
{{agent.first_name}}$b$, 20),
 ('Casting director submission', 'submission', 'casting', $s$Submission: {{model.name}}$s$,
  $b$Hi {{contact.first_name|there}},

Thank you for the opportunity. I'd like to submit {{model.name}} from {{agency.name}} for your casting.

{{model.measurements}}
Hair: {{model.hair}}  ·  Eyes: {{model.eyes}}
Profile: {{model.profile_link}}

Please let me know the date, time and location for the call, and anything they should bring or prepare.

Best,
{{agent.first_name}}$b$, 30),
 ('Casting follow-up', 'follow_up', 'casting', $s$Following up: {{model.name}}$s$,
  $b$Hi {{contact.first_name|there}},

I'm following up on {{model.name}}'s submission. Do you have any feedback, or an update on timing?

If it would help, I can send more material or arrange a call.

Thank you,
{{agent.first_name}}$b$, 40),
 ('Brand follow-up', 'follow_up', 'brand', $s$Following up: {{agency.name}} x {{company.name}}$s$,
  $b$Hi {{contact.first_name|there}},

I wanted to follow up on my earlier note. Is there anything coming up at {{company.name}} where we could help with talent?

Happy to send a selection or jump on a quick call, whichever suits you.

Best,
{{agent.first_name}}$b$, 50),
 ('Booking or option confirmation', 'confirmation', 'brand', $s$Confirmation: {{model.name}}$s$,
  $b$Hi {{contact.first_name|there}},

This confirms {{model.name}} for {{company.name}}. Please reply with the date, call time, location, rate and usage so we have everything in writing, and we will get the paperwork moving.

Thank you,
{{agent.first_name}}$b$, 60),
 ('Thank you after the job', 'thanks', 'brand', $s$Thank you from {{agency.name}}$s$,
  $b$Hi {{contact.first_name|there}},

Thank you for working with us on your recent shoot. We would love your feedback on {{model.name}}, and we are glad to help again whenever you have another project.

Best,
{{agent.first_name}}$b$, 70),
 ('Scouting: first approach', 'scouting', 'scout', $s${{agency.name}}: we would love to talk$s$,
  $b$Hi {{prospect.first_name|there}},

I'm {{agent.first_name}} at {{agency.name}}. We came across your profile and think you have a look we would like to explore.

If you are interested, reply with a few recent photos (natural light, no filters) and your height, and we can set up a short call to talk about what working with us would look like.

Best,
{{agent.first_name}}$b$, 80),
 ('Mother agency introduction', 'intro', 'mother', $s${{agency.name}} x {{company.name}}$s$,
  $b$Hi {{contact.first_name|there}},

I'm {{agent.first_name}} at {{agency.name}}. We have been in touch with {{prospect.name}} and would like to speak with you about working together on their career.

Could we find a time to talk this week?

Best,
{{agent.first_name}}$b$, 90)
) as v(name, situation, audience, subject, body, sort_order)
where o.slug = 'maison-de-veux'
on conflict do nothing;

-- Check
select name, situation, audience, active from public.email_templates order by sort_order;
