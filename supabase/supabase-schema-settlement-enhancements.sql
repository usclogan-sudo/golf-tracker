-- ═══════════════════════════════════════════════════════════════════════════════
-- Settlement Enhancements: Player "I Paid" Flow
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add player_reported_at column to settlements (player self-reports payment)
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS player_reported_at timestamptz;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS reported_method text;

-- Player self-reports settlement payment (does NOT mark as paid — treasurer confirms)
CREATE OR REPLACE FUNCTION player_report_settlement(
  p_settlement_id text,
  p_method text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_round_id text;
  v_from_player_id text;
BEGIN
  -- Get settlement details
  SELECT round_id, from_player_id
  INTO v_round_id, v_from_player_id
  FROM settlements
  WHERE id = p_settlement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Settlement not found';
  END IF;

  -- Verify caller owns this player slot via round_participants
  IF NOT EXISTS (
    SELECT 1 FROM round_participants
    WHERE round_id = v_round_id AND player_id = v_from_player_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized — you are not the payer in this settlement';
  END IF;

  -- Update the settlement: set method + player_reported_at timestamp
  UPDATE settlements
  SET reported_method = p_method,
      player_reported_at = now()
  WHERE id = p_settlement_id;
END;
$$;
