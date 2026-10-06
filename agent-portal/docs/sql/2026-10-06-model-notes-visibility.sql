-- Model 360 notes: let agents mark a note "Shareable" (visible to the model) or "Internal".
-- Additive and safe to run more than once. Run in the Supabase SQL editor.
-- Until this runs, the app stores the flag inside model_notes.metadata when that column exists,
-- and otherwise shows a message asking for this migration.

alter table public.model_notes add column if not exists visible_to_model boolean not null default false;
alter table public.model_notes add column if not exists title text;
alter table public.model_notes add column if not exists note_type text;
alter table public.model_notes add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Carry over anything already stored in metadata by the fallback.
update public.model_notes
   set visible_to_model = true
 where visible_to_model = false
   and (metadata ->> 'visible_to_model') = 'true';

create index if not exists model_notes_model_visible_idx
  on public.model_notes (organization_id, model_id, visible_to_model);
