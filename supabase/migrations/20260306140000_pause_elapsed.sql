-- Store elapsed milliseconds and phase when a session is paused
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS paused_elapsed_ms bigint;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS paused_phase text;
