-- Backend timer support: track round timing server-side
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS current_round_started_at timestamptz;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS current_phase text NOT NULL DEFAULT 'idle'
  CHECK (current_phase IN ('idle', 'playing', 'resting'));
