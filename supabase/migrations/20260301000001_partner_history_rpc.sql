-- RPC to increment partner history (called from Edge Function)
CREATE OR REPLACE FUNCTION increment_partner_history(
  p_session_id uuid,
  p_player1_id uuid,
  p_player2_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO partner_history (session_id, player1_id, player2_id, times_paired)
  VALUES (p_session_id, p_player1_id, p_player2_id, 1)
  ON CONFLICT (session_id, player1_id, player2_id)
  DO UPDATE SET
    times_paired = partner_history.times_paired + 1,
    updated_at = now();
END;
$$;

-- RPC to increment play count (called from Edge Function)
CREATE OR REPLACE FUNCTION increment_play_count(
  p_session_id uuid,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE session_players
  SET play_count = play_count + 1,
      last_played_at = now()
  WHERE session_id = p_session_id
    AND user_id = p_user_id;
END;
$$;
