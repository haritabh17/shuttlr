-- Switch invoke_session_tick to use CRON_SECRET header instead of Bearer token.
-- The CRON_SECRET is stored in Vault and also set as an edge function env var.

CREATE OR REPLACE FUNCTION public.invoke_session_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_running_sessions boolean;
  cron_secret text;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.sessions WHERE status = 'running'
  ) INTO has_running_sessions;

  IF NOT has_running_sessions THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  IF cron_secret IS NULL THEN
    RAISE WARNING 'cron_secret not found in vault';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := 'https://iyctsbavhelyivdgulsl.supabase.co/functions/v1/session-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := '{}'::jsonb
  );
END;
$$;
