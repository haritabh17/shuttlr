-- Add 'pending' to session_players status CHECK constraint
ALTER TABLE public.session_players DROP CONSTRAINT IF EXISTS session_players_status_check;
ALTER TABLE public.session_players ADD CONSTRAINT session_players_status_check
  CHECK (status IN ('available', 'selected', 'playing', 'resting', 'removed', 'pending'));
