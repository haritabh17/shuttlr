-- Prune old session operational data; extend weekly cleanup job.

CREATE OR REPLACE FUNCTION public.cleanup_old_session_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff timestamptz := now() - interval '90 days';
  old_session_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO old_session_ids
  FROM sessions
  WHERE status = 'ended'
    AND ended_at IS NOT NULL
    AND ended_at < cutoff;

  IF old_session_ids IS NULL OR array_length(old_session_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM court_assignments WHERE session_id = ANY (old_session_ids);
  DELETE FROM partner_history WHERE session_id = ANY (old_session_ids);
  DELETE FROM events
  WHERE session_id = ANY (old_session_ids)
     OR (club_id IN (SELECT DISTINCT club_id FROM sessions WHERE id = ANY (old_session_ids))
         AND created_at < cutoff
         AND event_type IN ('selection_run', 'session_auto_ended'));
END;
$$;

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

  PERFORM public.cleanup_old_session_data();
END;
$$;
