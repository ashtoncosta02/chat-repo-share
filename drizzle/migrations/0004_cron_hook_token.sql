-- Scheduled maintenance jobs now prove themselves with a token generated inside the
-- database, so it never appears in source code. Only the database owner (pg_cron)
-- and the security-definer check below can read it.
CREATE TABLE IF NOT EXISTS public.cron_hook_tokens (
  name text PRIMARY KEY,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.cron_hook_tokens FROM PUBLIC;
REVOKE ALL ON public.cron_hook_tokens FROM anon, authenticated, service_role;
ALTER TABLE public.cron_hook_tokens ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: no API role may read or write this table.

INSERT INTO public.cron_hook_tokens (name, token)
VALUES (
  'maintenance',
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
)
ON CONFLICT (name) DO NOTHING;

-- Server-side check used by the maintenance endpoints (service role only).
CREATE OR REPLACE FUNCTION public.verify_cron_hook_token(p_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(length(p_token), 0) >= 32 AND EXISTS (
    SELECT 1 FROM public.cron_hook_tokens
    WHERE name = 'maintenance' AND token = p_token
  );
$$;

REVOKE ALL ON FUNCTION public.verify_cron_hook_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_cron_hook_token(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_hook_token(text) TO service_role;

-- Add the token header to the two scheduled jobs (read from the table at run time).
DO $$
DECLARE
  j record;
  new_cmd text;
BEGIN
  FOR j IN
    SELECT jobid, command FROM cron.job
    WHERE jobname IN ('auto-delete-non-lead-threads', 'backfill-missed-calls')
      AND command NOT LIKE '%X-Cron-Token%'
  LOOP
    new_cmd := regexp_replace(
      j.command,
      $r$(\}'::jsonb),$r$,
      $r$\1 || jsonb_build_object('X-Cron-Token', (SELECT token FROM public.cron_hook_tokens WHERE name = 'maintenance')),$r$
    );
    IF new_cmd = j.command OR new_cmd NOT LIKE '%X-Cron-Token%' THEN
      RAISE EXCEPTION 'Could not add token header to cron job %', j.jobid;
    END IF;
    PERFORM cron.alter_job(job_id := j.jobid, command := new_cmd);
  END LOOP;
END
$$;