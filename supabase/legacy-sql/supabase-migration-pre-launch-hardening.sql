-- Pre-launch hardening migration (Batch A)
-- Idempotent: every statement uses IF NOT EXISTS / OR REPLACE.
-- Bundles four fixes from the audit:
--   0.5  unique constraint on hole_scores(round_id, player_id, hole_number)
--   0.6  delete_own_round must also remove prop_bets and prop_wagers
--   1.1  index round_participants(user_id) for "my rounds" queries
--   1.2  partial index rounds(invite_code) WHERE status='active' for invite RPC

-- ── 0.5: De-dup hole_scores then enforce uniqueness ─────────────────────────
-- Keep the most recently updated row per (round_id, player_id, hole_number);
-- ties broken by id so the operation is deterministic.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY round_id, player_id, hole_number
           ORDER BY updated_at DESC NULLS LAST, id
         ) AS rn
    FROM hole_scores
)
DELETE FROM hole_scores
 WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hole_scores_round_player_hole
  ON hole_scores(round_id, player_id, hole_number);

-- ── 1.1: User-leading index on round_participants ───────────────────────────
-- The existing idx_round_participants_round_user has round_id leading and is
-- useless for queries like .eq('user_id', userId). This adds the user-leading
-- variant.
CREATE INDEX IF NOT EXISTS idx_round_participants_user
  ON round_participants(user_id);

-- ── 1.2: Partial index for active-round invite lookup ───────────────────────
CREATE INDEX IF NOT EXISTS idx_rounds_invite_code_active
  ON rounds(invite_code)
  WHERE status = 'active';

-- ── 0.6: Extend delete_own_round to clear prop_bets and prop_wagers ─────────
CREATE OR REPLACE FUNCTION delete_own_round(p_round_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify caller owns the round
  IF NOT EXISTS (SELECT 1 FROM rounds WHERE id = p_round_id AND user_id = v_caller) THEN
    RAISE EXCEPTION 'Not authorized to delete this round';
  END IF;

  -- All in one transaction (SECURITY DEFINER = already in one)
  DELETE FROM hole_scores WHERE round_id = p_round_id;
  DELETE FROM round_players WHERE round_id = p_round_id;
  DELETE FROM buy_ins WHERE round_id = p_round_id;
  DELETE FROM bbb_points WHERE round_id = p_round_id;
  DELETE FROM settlements WHERE round_id = p_round_id;
  DELETE FROM side_bets WHERE round_id = p_round_id;
  DELETE FROM round_participants WHERE round_id = p_round_id;
  DELETE FROM notifications WHERE round_id = p_round_id;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'junk_records') THEN
    EXECUTE 'DELETE FROM junk_records WHERE round_id = $1' USING p_round_id;
  END IF;

  -- Prop bets + wagers were missed in the original delete_own_round and left orphans behind.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prop_wagers') THEN
    EXECUTE 'DELETE FROM prop_wagers WHERE round_id = $1' USING p_round_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prop_bets') THEN
    EXECUTE 'DELETE FROM prop_bets WHERE round_id = $1' USING p_round_id;
  END IF;

  DECLARE
    v_event_id text;
  BEGIN
    SELECT event_id INTO v_event_id FROM rounds WHERE id = p_round_id;
    IF v_event_id IS NOT NULL THEN
      DELETE FROM event_participants WHERE event_id = v_event_id;
      DELETE FROM events WHERE id = v_event_id;
    END IF;
  END;

  DELETE FROM rounds WHERE id = p_round_id;
END;
$$;
