-- Phase 1: Algorithm configuration + next-up support

-- 1. Add algorithm config columns to sessions
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS mixed_ratio smallint NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS skill_balance smallint NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS partner_variety smallint NOT NULL DEFAULT 80;

-- Add constraints
ALTER TABLE sessions
  ADD CONSTRAINT chk_mixed_ratio CHECK (mixed_ratio BETWEEN 0 AND 100),
  ADD CONSTRAINT chk_skill_balance CHECK (skill_balance BETWEEN 0 AND 100),
  ADD CONSTRAINT chk_partner_variety CHECK (partner_variety BETWEEN 0 AND 100);

-- 2. Add status + game_type to court_assignments
ALTER TABLE court_assignments
  ADD COLUMN IF NOT EXISTS assignment_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS game_type text;

-- Constrain values
ALTER TABLE court_assignments
  ADD CONSTRAINT chk_assignment_status CHECK (assignment_status IN ('active', 'upcoming')),
  ADD CONSTRAINT chk_game_type CHECK (game_type IN ('mixed', 'doubles') OR game_type IS NULL);

-- Index for quick lookup of upcoming assignments
CREATE INDEX IF NOT EXISTS idx_court_assignments_status
  ON court_assignments (session_id, assignment_status)
  WHERE assignment_status = 'upcoming';

-- 3. Partner history table — tracks how often players are paired per session
CREATE TABLE IF NOT EXISTS partner_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  player1_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player2_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  times_paired smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Always store smaller UUID first to avoid duplicates
  CONSTRAINT chk_player_order CHECK (player1_id < player2_id),
  CONSTRAINT uq_partner_history UNIQUE (session_id, player1_id, player2_id)
);

-- RLS
ALTER TABLE partner_history ENABLE ROW LEVEL SECURITY;

-- Members can read partner history for their club's sessions
CREATE POLICY "Members can view partner history" ON partner_history
  FOR SELECT USING (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN club_members cm ON cm.club_id = s.club_id
      WHERE cm.user_id = auth.uid() AND cm.status = 'active'
    )
  );

-- Service role / triggers need full access
CREATE POLICY "Service can manage partner history" ON partner_history
  FOR ALL USING (auth.role() = 'service_role');

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_partner_history_session
  ON partner_history (session_id);

CREATE INDEX IF NOT EXISTS idx_partner_history_players
  ON partner_history (session_id, player1_id, player2_id);

-- 4. Add flag to track if next round selection has fired
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS next_round_selected boolean NOT NULL DEFAULT false;
