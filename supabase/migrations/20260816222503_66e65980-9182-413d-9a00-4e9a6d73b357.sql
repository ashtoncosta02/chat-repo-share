select cron.unschedule('auto-delete-non-lead-threads');
select cron.unschedule('backfill-missed-calls');

select cron.schedule(
  'auto-delete-non-lead-threads',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://project--d1e796ad-671c-47e1-843b-cdecc02fe11f.lovable.app/api/public/hooks/auto-delete-threads',
    headers := '{"Content-Type": "application/json", "X-Cron-Secret": "6ca84ac3533fd151b173e8c88250e46ff7044d810e33b0a9"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'backfill-missed-calls',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://project--d1e796ad-671c-47e1-843b-cdecc02fe11f.lovable.app/api/public/hooks/backfill-calls',
    headers := '{"Content-Type": "application/json", "X-Cron-Secret": "6ca84ac3533fd151b173e8c88250e46ff7044d810e33b0a9"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);