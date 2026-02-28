-- Fix: trigger needs to bypass RLS to insert into session_usage
-- Set the function to run as SECURITY DEFINER (superuser context)
CREATE OR REPLACE FUNCTION track_session_usage()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'running' AND OLD.status = 'initiated' THEN
    INSERT INTO session_usage (club_id, month, session_count)
    VALUES (NEW.club_id, to_char(now(), 'YYYY-MM'), 1)
    ON CONFLICT (club_id, month)
    DO UPDATE SET session_count = session_usage.session_count + 1, updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
