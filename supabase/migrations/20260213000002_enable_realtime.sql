-- Enable Supabase Realtime on tables needed for live notifications
ALTER PUBLICATION supabase_realtime ADD TABLE court_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
