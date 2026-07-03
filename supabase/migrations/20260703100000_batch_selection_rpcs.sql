-- Batch RPCs for the selection flow: replace per-row round-trips
-- (one RPC per pair, one UPDATE per player) with single set-based statements.

-- Increment pairing counts for a whole round in one call.
-- p_pairs: jsonb array of {"player1_id": uuid, "player2_id": uuid}.
-- Pairs must be unique within the array (guaranteed by extractPairs: a player
-- appears on at most one court per round), otherwise ON CONFLICT would see
-- the same row twice in one statement.
CREATE OR REPLACE FUNCTION increment_partner_history_batch(
  p_session_id uuid,
  p_pairs jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO partner_history (session_id, player1_id, player2_id, times_paired)
  SELECT p_session_id,
         (pair->>'player1_id')::uuid,
         (pair->>'player2_id')::uuid,
         1
  FROM jsonb_array_elements(p_pairs) AS pair
  ON CONFLICT (session_id, player1_id, player2_id)
  DO UPDATE SET
    times_paired = partner_history.times_paired + 1,
    updated_at = now();
END;
$$;

-- Start a round for the selected players in one call: mark them playing and
-- increment play_count server-side, so a concurrent write can't clobber the
-- count with a stale client-computed value.
CREATE OR REPLACE FUNCTION begin_round_players(
  p_session_id uuid,
  p_user_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE session_players
  SET status = 'playing',
      play_count = play_count + 1,
      last_played_at = now()
  WHERE session_id = p_session_id
    AND user_id = ANY(p_user_ids);
END;
$$;
