-- Drop the monthly session usage trigger (replaced by total session cap)
DROP TRIGGER IF EXISTS on_session_started ON sessions;
DROP FUNCTION IF EXISTS track_session_usage();
-- Keep session_usage table for historical data, but it won't be written to anymore
