-- Culture Lab Casting: run the timed rules every 10 minutes, and limit the file types the storage bucket accepts.
-- Run once in SQL Editor after 01 and 02. Safe to run again.
-- Before running: the value in x-cron-secret must match the CULTURE_LAB_CRON_SECRET Edge Function secret.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'culture-lab-rules';
select cron.schedule('culture-lab-rules', '*/10 * * * *', $job$
  select net.http_post(
    url := 'https://uhdcoebqcdqsvxyjadeh.supabase.co/functions/v1/culture-lab-api',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', 'PASTE-THE-CULTURE_LAB_CRON_SECRET-VALUE-HERE'),
    body := '{"action":"tick"}'::jsonb,
    timeout_milliseconds := 30000
  );
$job$);

-- Only these file types can be stored. Larger video needs the Supabase Pro plan (the Free plan caps each file at 50 MB).
update storage.buckets
set allowed_mime_types = array['video/mp4','video/quicktime','video/x-m4v','video/webm','audio/mpeg','audio/mp4','audio/wav','audio/aac','image/jpeg','image/png','image/heic','image/heif','image/webp','image/gif','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','application/rtf','text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    file_size_limit = 2147483648
where id = 'culture-lab-files';
