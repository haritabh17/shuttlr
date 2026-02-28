-- Enable pg_cron and pg_net extensions (both available in Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the session-tick Edge Function to run every 10 seconds
-- pg_cron minimum interval is 1 minute with standard syntax,
-- so we use 6 jobs offset by 10 seconds each to achieve ~10s polling.

-- Helper function to call the edge function via pg_net
CREATE OR REPLACE FUNCTION public.invoke_session_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url text;
  service_role_key text;
  has_running_sessions boolean;
BEGIN
  -- Only call if there are running sessions (saves unnecessary invocations)
  SELECT EXISTS(
    SELECT 1 FROM public.sessions WHERE status = 'running'
  ) INTO has_running_sessions;

  IF NOT has_running_sessions THEN
    RETURN;
  END IF;

  -- Get config from vault or use defaults for local dev
  -- In production, set these via Supabase dashboard > Edge Functions
  edge_function_url := coalesce(
    current_setting('app.settings.edge_function_url', true),
    'http://127.0.0.1:54321/functions/v1/session-tick'
  );
  service_role_key := coalesce(
    current_setting('app.settings.service_role_key', true),
    current_setting('supabase.service_role_key', true)
  );

  -- Call edge function via pg_net
  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Schedule: run every 10 seconds using 6 cron jobs with pg_sleep offsets
-- Each job runs every minute but with a different initial delay
SELECT cron.schedule('session-tick-0', '* * * * *', $$SELECT public.invoke_session_tick()$$);
SELECT cron.schedule('session-tick-10', '* * * * *', $$SELECT pg_sleep(10); SELECT public.invoke_session_tick()$$);
SELECT cron.schedule('session-tick-20', '* * * * *', $$SELECT pg_sleep(20); SELECT public.invoke_session_tick()$$);
SELECT cron.schedule('session-tick-30', '* * * * *', $$SELECT pg_sleep(30); SELECT public.invoke_session_tick()$$);
SELECT cron.schedule('session-tick-40', '* * * * *', $$SELECT pg_sleep(40); SELECT public.invoke_session_tick()$$);
SELECT cron.schedule('session-tick-50', '* * * * *', $$SELECT pg_sleep(50); SELECT public.invoke_session_tick()$$);
