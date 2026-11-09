-- What else is taking space? READ-ONLY: nothing here deletes or changes anything. Run each query on its own.
-- Files are stored as "<organization id>/<area>/...", so the second part of the path says what a file is for.

-- 1. Space by bucket and area (models, editorial, model-submissions, exports, documents ...), with big videos split out
select bucket_id, (string_to_array(name, '/'))[2] as area, count(*) as files,
       round(sum((metadata->>'size')::bigint) / 1048576.0, 1) as mb,
       round(sum((metadata->>'size')::bigint) filter (where metadata->>'mimetype' like 'video/%') / 1048576.0, 1) as video_mb,
       min(created_at)::date as oldest, max(created_at)::date as newest
from storage.objects where metadata->>'size' is not null
group by 1, 2 order by sum((metadata->>'size')::bigint) desc;

-- 2. Files that nothing in the database points at, older than 7 days (abandoned uploads, replaced files, old exports).
--    "Nothing" means: documents, form uploads, data exports and model photos. Website content is NOT checked,
--    so treat the 'editorial' area with care.
with o as (
  select bucket_id, name, (metadata->>'size')::bigint as size, created_at,
         (string_to_array(name, '/'))[2] as area,
         substring(name from '/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-[^/]*$') as file_id
  from storage.objects where metadata->>'size' is not null and created_at < now() - interval '7 days'
), r as (
  select o.*,
    ( exists (select 1 from public.documents d where d.storage_bucket = o.bucket_id and d.storage_path = o.name)
   or exists (select 1 from public.agency_form_files f where f.storage_bucket = o.bucket_id and f.storage_path = o.name)
   or exists (select 1 from public.data_export_jobs j where j.storage_bucket = o.bucket_id and j.storage_path = o.name)
   or (o.file_id is not null and exists (select 1 from public.model_media mm where mm.url like '%' || o.file_id || '%')) ) as referenced
  from o
)
select bucket_id, area, count(*) as unreferenced_files, round(sum(size) / 1048576.0, 1) as mb
from r where not referenced group by 1, 2 order by sum(size) desc;

-- 3. The 30 biggest unreferenced files (same test as query 2)
with o as (
  select bucket_id, name, (metadata->>'size')::bigint as size, created_at, metadata->>'mimetype' as type,
         substring(name from '/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-[^/]*$') as file_id
  from storage.objects where metadata->>'size' is not null and created_at < now() - interval '7 days'
)
select bucket_id, name, round(size / 1048576.0, 1) as mb, type, created_at::date as added
from o
where not ( exists (select 1 from public.documents d where d.storage_bucket = o.bucket_id and d.storage_path = o.name)
         or exists (select 1 from public.agency_form_files f where f.storage_bucket = o.bucket_id and f.storage_path = o.name)
         or exists (select 1 from public.data_export_jobs j where j.storage_bucket = o.bucket_id and j.storage_path = o.name)
         or (o.file_id is not null and exists (select 1 from public.model_media mm where mm.url like '%' || o.file_id || '%')) )
order by size desc limit 30;

-- 4. Videos over 10 MB, biggest first (phone videos are usually the largest single files)
select bucket_id, name, round((metadata->>'size')::bigint / 1048576.0, 1) as mb, created_at::date as added
from storage.objects
where metadata->>'mimetype' like 'video/%' and (metadata->>'size')::bigint > 10 * 1048576
order by (metadata->>'size')::bigint desc limit 30;
