-- Mail signature, saved per team member so it follows them to every device.
-- Safe to run more than once. Run in the Supabase SQL editor.
alter table public.mail_connections add column if not exists signature jsonb;
