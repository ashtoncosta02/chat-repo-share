
-- Enable pg_cron so we can run periodic cleanup of ephemeral call audio.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Hourly job: delete any object in call-audio older than 24 hours.
-- This is safe to call repeatedly because storage.objects deletes are
-- idempotent when nothing matches the WHERE clause.
SELECT cron.unschedule('cleanup-call-audio-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-call-audio-hourly'
);

SELECT cron.schedule(
  'cleanup-call-audio-hourly',
  '17 * * * *', -- every hour at :17 to avoid the top-of-hour stampede
  $$
  DELETE FROM storage.objects
  WHERE bucket_id = 'call-audio'
    AND created_at < now() - interval '24 hours';
  $$
);
