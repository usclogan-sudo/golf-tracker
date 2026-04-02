-- Prop Bets Hardening Migration
-- Run AFTER supabase-schema-prop-bets.sql
-- Fixes RLS for multi-user access, adds constraints and indexes

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. FIX RLS POLICIES (Critical: allows all round participants to see props)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop the simple "for all" policies
DROP POLICY IF EXISTS "Users manage own prop_bets" ON prop_bets;
DROP POLICY IF EXISTS "Users manage own prop_wagers" ON prop_wagers;

-- prop_bets: participants can READ all props in their rounds
CREATE POLICY "read prop_bets" ON prop_bets
  FOR SELECT USING (
    user_id = auth.uid()
    OR round_id IN (SELECT round_id FROM round_participants WHERE user_id = auth.uid())
    OR round_id IN (SELECT id FROM rounds WHERE user_id = auth.uid())
  );

-- prop_bets: only owner can INSERT
CREATE POLICY "insert prop_bets" ON prop_bets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- prop_bets: only owner can UPDATE (resolve, void, lock)
CREATE POLICY "update prop_bets" ON prop_bets
  FOR UPDATE USING (auth.uid() = user_id);

-- prop_bets: only owner can DELETE
CREATE POLICY "delete prop_bets" ON prop_bets
  FOR DELETE USING (auth.uid() = user_id);

-- prop_wagers: participants can READ all wagers in their rounds
CREATE POLICY "read prop_wagers" ON prop_wagers
  FOR SELECT USING (
    user_id = auth.uid()
    OR round_id IN (SELECT round_id FROM round_participants WHERE user_id = auth.uid())
    OR round_id IN (SELECT id FROM rounds WHERE user_id = auth.uid())
  );

-- prop_wagers: only owner can INSERT their own wagers
CREATE POLICY "insert prop_wagers" ON prop_wagers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- prop_wagers: only owner can UPDATE
CREATE POLICY "update prop_wagers" ON prop_wagers
  FOR UPDATE USING (auth.uid() = user_id);

-- prop_wagers: only owner can DELETE
CREATE POLICY "delete prop_wagers" ON prop_wagers
  FOR DELETE USING (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. UNIQUE CONSTRAINTS (prevent duplicate wagers, race conditions)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Prevent same player from wagering twice on the same prop bet
CREATE UNIQUE INDEX IF NOT EXISTS unique_wager_per_player_prop
  ON prop_wagers(prop_bet_id, player_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. CHECK CONSTRAINTS (data integrity)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Ensure stake and wager amounts are positive
ALTER TABLE prop_bets ADD CONSTRAINT prop_bets_stake_positive CHECK (stake_cents > 0);
ALTER TABLE prop_wagers ADD CONSTRAINT prop_wagers_amount_positive CHECK (amount_cents > 0);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. PERFORMANCE INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_prop_bets_round_id ON prop_bets(round_id);
CREATE INDEX IF NOT EXISTS idx_prop_bets_round_status ON prop_bets(round_id, status);
CREATE INDEX IF NOT EXISTS idx_prop_bets_creator ON prop_bets(creator_id);
CREATE INDEX IF NOT EXISTS idx_prop_wagers_prop_bet ON prop_wagers(prop_bet_id);
CREATE INDEX IF NOT EXISTS idx_prop_wagers_round ON prop_wagers(round_id);
CREATE INDEX IF NOT EXISTS idx_prop_wagers_player ON prop_wagers(player_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. ALSO FIX side_bets RLS (same bug — never got phase 9 treatment)
-- ═══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can manage own side bets" ON side_bets;

CREATE POLICY "read side_bets" ON side_bets
  FOR SELECT USING (
    user_id = auth.uid()
    OR round_id IN (SELECT round_id FROM round_participants WHERE user_id = auth.uid())
    OR round_id IN (SELECT id FROM rounds WHERE user_id = auth.uid())
  );

CREATE POLICY "insert side_bets" ON side_bets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update side_bets" ON side_bets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "delete side_bets" ON side_bets
  FOR DELETE USING (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. ADD prop tables to the delete_round_cascade function
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION delete_round_cascade(p_round_id TEXT, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify ownership
  IF NOT EXISTS (SELECT 1 FROM rounds WHERE id = p_round_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Not authorized to delete this round';
  END IF;

  DELETE FROM prop_wagers WHERE round_id = p_round_id;
  DELETE FROM prop_bets WHERE round_id = p_round_id;
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

  DELETE FROM rounds WHERE id = p_round_id AND user_id = p_user_id;
END;
$$;
