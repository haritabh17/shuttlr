-- Realtime with RLS requires REPLICA IDENTITY FULL to evaluate policies on changes.
-- Without this, Realtime silently drops events for RLS-protected tables.

ALTER TABLE sessions REPLICA IDENTITY FULL;
ALTER TABLE court_assignments REPLICA IDENTITY FULL;
ALTER TABLE session_players REPLICA IDENTITY FULL;

-- Also ensure session_players is in the Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'session_players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE session_players;
  END IF;
END $$;
