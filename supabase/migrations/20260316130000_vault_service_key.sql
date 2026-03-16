-- Store service_role_key in Supabase Vault instead of hardcoding in functions.
-- The actual secret value must be inserted via Supabase Dashboard > Vault > New Secret
-- Name: service_role_key
-- Value: (the service role JWT)

-- Update invoke_session_tick to read key from Vault
CREATE OR REPLACE FUNCTION public.invoke_session_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_running_sessions boolean;
  svc_key text;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.sessions WHERE status = 'running'
  ) INTO has_running_sessions;

  IF NOT has_running_sessions THEN
    RETURN;
  END IF;

  -- Read service role key from Supabase Vault
  SELECT decrypted_secret INTO svc_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF svc_key IS NULL THEN
    RAISE WARNING 'service_role_key not found in vault — skipping session-tick invocation';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://iyctsbavhelyivdgulsl.supabase.co/functions/v1/session-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body := '{}'::jsonb
  );
END;
$$;
