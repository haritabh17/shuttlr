-- Consolidate duplicate session-tick cron jobs and prune internal log tables.
-- Production had accumulated 12 jobs (every 5s) → ~1.2M rows in cron.job_run_details (~493 MB).

-- 1. Remove every session-tick job (by command; catches duplicates from re-runs)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT jobid FROM cron.job
    WHERE command LIKE '%invoke_session_tick%'
  LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END $$;

-- 2. Re-schedule: 6 jobs, 10s apart (~10s session-tick polling)
SELECT cron.schedule('session-tick-0', '* * * * *', $$SELECT public.invoke_session_tick()$$);
SELECT cron.schedule('session-tick-10', '* * * * *', $$SELECT pg_sleep(10); SELECT public.invoke_session_tick()$$);
SELECT cron.schedule('session-tick-20', '* * * * *', $$SELECT pg_sleep(20); SELECT public.invoke_session_tick()$$);
SELECT cron.schedule('session-tick-30', '* * * * *', $$SELECT pg_sleep(30); SELECT public.invoke_session_tick()$$);
SELECT cron.schedule('session-tick-40', '* * * * *', $$SELECT pg_sleep(40); SELECT public.invoke_session_tick()$$);
SELECT cron.schedule('session-tick-50', '* * * * *', $$SELECT pg_sleep(50); SELECT public.invoke_session_tick()$$);

-- 3. Weekly cleanup of pg_cron run history and pg_net HTTP responses
CREATE OR REPLACE FUNCTION public.cleanup_cron_and_net_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
BEGIN
  DELETE FROM cron.job_run_details
  WHERE end_time < now() - interval '14 days';

  DELETE FROM net._http_response
  WHERE created < now() - interval '14 days';
END;
$$;

-- Drop previous cleanup job if present (ignore if missing)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-cron-net-logs');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-cron-net-logs',
  '0 3 * * 0',
  $$SELECT public.cleanup_cron_and_net_logs()$$
);
