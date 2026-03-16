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

  -- Use service_role key from Supabase Vault (stored as 'service_role_key')
  PERFORM net.http_post(
    url := 'https://iyctsbavhelyivdgulsl.supabase.co/functions/v1/session-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
END;
$$;
