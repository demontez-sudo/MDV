-- Follow-up to the storage reports. READ-ONLY. Run each query on its own.

-- 1. Does anything in the database mention these? Searches every text column in every table in the public schema
--    for each pattern and lists only the places that match. No match anywhere = nothing in the database uses it.
with pats(p) as (values
  ('%/mdv-files/%'),                                   -- the old mdv-files bucket (128 MB, 892 files)
  ('%/editorial/%'),                                   -- the editorial photos
  ('%5147c054-b04a-418e-8087-2f09497c98b1%'),          -- IMG_5553 copy A
  ('%26643e8a-2f84-4f19-ae42-7f6f09d22993%'),          -- IMG_5553 copy B
  ('%c550d6a8-cb92-4951-b43d-c3b3aeab0841%')           -- IMG_5555
), cols as (
  select c.table_name, c.column_name from information_schema.columns c
  join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
  where c.table_schema = 'public' and c.data_type in ('text', 'character varying', 'jsonb', 'json')
)
select table_name, column_name, p as pattern, hits from (
  select cols.table_name, cols.column_name, pats.p,
    (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I where %I::text like %L', cols.table_name, cols.column_name, pats.p), false, true, '')))[1]::text::int as hits
  from cols cross join pats
) x where hits > 0 order by pattern, hits desc;

-- 2. What are the 943 files directly under <org>/<org>/ in veux-private (455 MB)? Grouped by the document they belong to.
with f as (
  select o.name, (o.metadata->>'size')::bigint as size, o.created_at
  from storage.objects o
  where o.bucket_id = 'veux-private' and split_part(o.name, '/', 2) = split_part(o.name, '/', 1) and o.metadata->>'size' is not null
)
select coalesce(d.category, '(no document category)') as category, coalesce(d.mime_type, '') as type,
       count(*) as files, round(sum(f.size) / 1048576.0, 1) as mb,
       min(f.created_at)::date as first_added, max(f.created_at)::date as last_added,
       (array_agg(d.name order by f.size desc))[1] as biggest_name
from f left join public.documents d on d.storage_bucket = 'veux-private' and d.storage_path = f.name
group by 1, 2 order by sum(f.size) desc limit 40;
