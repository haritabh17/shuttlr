CREATE OR REPLACE FUNCTION public.invoke_session_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_running_sessions boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.sessions WHERE status = 'running'
  ) INTO has_running_sessions;

  IF NOT has_running_sessions THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://iyctsbavhelyivdgulsl.supabase.co/functions/v1/session-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ***REMOVED***'
    ),
    body := '{}'::jsonb
  );
END;
$$;
