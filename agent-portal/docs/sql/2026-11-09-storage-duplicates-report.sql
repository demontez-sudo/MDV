-- Storage clean-up report. READ-ONLY: nothing here deletes or changes anything.
-- Run each query on its own in the Supabase SQL editor (MAISON DE VEUX project).
-- The portal names every upload "<random id>-<original file name>", so the same photo uploaded twice is two files.

-- 1. How much space is wasted by exact duplicates (same folder, same file name, same size)?
with o as (
  select bucket_id, name, (metadata->>'size')::bigint as size,
         regexp_replace(name, '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-([^/]*)$', '/\1') as base
  from storage.objects where metadata->>'size' is not null
), g as (
  select bucket_id, base, size, count(*) as copies from o group by 1, 2, 3 having count(*) > 1
)
select bucket_id, count(*) as duplicate_groups, sum(copies - 1) as extra_copies,
       round(sum((copies - 1) * size) / 1048576.0, 1) as wasted_mb
from g group by bucket_id order by wasted_mb desc;

-- 2. Every duplicate copy, with whether a model's profile uses it (model_media.url contains the file's id).
--    Only delete copies marked used = false, and only in groups where another copy is marked used = true.
with o as (
  select bucket_id, name, (metadata->>'size')::bigint as size, created_at,
         regexp_replace(name, '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-([^/]*)$', '/\1') as base,
         substring(name from '/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-[^/]*$') as file_id
  from storage.objects where metadata->>'size' is not null
), d as (
  select o.*, count(*) over (partition by bucket_id, base, size) as copies from o
), u as (
  select d.*, exists (select 1 from public.model_media mm where d.file_id is not null and mm.url like '%' || d.file_id || '%') as used
  from d where copies > 1
)
select bucket_id, name, round(size / 1048576.0, 1) as mb, created_at::date as added, used,
       bool_or(used) over (partition by bucket_id, base, size) as group_has_used_copy
from u order by bucket_id, base, used desc, created_at;

-- 3. How much could shrinking large images save? (photos over 5 MB, per folder)
select bucket_id, count(*) as big_images, round(sum((metadata->>'size')::bigint) / 1048576.0, 1) as mb
from storage.objects
where (metadata->>'mimetype') like 'image/%' and (metadata->>'size')::bigint > 5 * 1048576
group by bucket_id order by mb desc;
