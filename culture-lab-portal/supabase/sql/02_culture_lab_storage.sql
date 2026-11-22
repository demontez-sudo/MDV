-- Culture Lab Casting files: one private bucket. Files are reached only through short-lived signed links from culture-lab-api.
insert into storage.buckets (id, name, public, file_size_limit)
values ('culture-lab-files', 'culture-lab-files', false, 2147483648)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
-- Allowed file types are set in 03_culture_lab_schedule.sql.
