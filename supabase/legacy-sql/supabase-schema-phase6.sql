-- Phase 6: Linked Groups + Shared Scoreboard
-- Run this migration in the Supabase SQL editor

-- Add groups column to rounds
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS groups jsonb;

-- Allow authenticated users to READ rounds they're a player in
-- (existing owner policy handles user_id = auth.uid(), this adds participant access)
CREATE POLICY "player can read round" ON rounds
  FOR SELECT USING (
    auth.uid() = user_id
    OR players::jsonb @> ('[{"id":"' || auth.uid()::text || '"}]')::jsonb
  );

-- Allow reading hole_scores for rounds you're a player in
CREATE POLICY "player can read scores" ON hole_scores
  FOR SELECT USING (
    auth.uid() = user_id
    OR round_id IN (
      SELECT id FROM rounds
      WHERE players::jsonb @> ('[{"id":"' || auth.uid()::text || '"}]')::jsonb
    )
  );

-- Allow reading bbb_points for rounds you're a player in
CREATE POLICY "player can read bbb" ON bbb_points
  FOR SELECT USING (
    auth.uid() = user_id
    OR round_id IN (
      SELECT id FROM rounds
      WHERE players::jsonb @> ('[{"id":"' || auth.uid()::text || '"}]')::jsonb
    )
  );

-- Allow reading junk_records for rounds you're a player in
CREATE POLICY "player can read junks" ON junk_records
  FOR SELECT USING (
    auth.uid() = user_id
    OR round_id IN (
      SELECT id FROM rounds
      WHERE players::jsonb @> ('[{"id":"' || auth.uid()::text || '"}]')::jsonb
    )
  );

-- Allow reading round_players for rounds you're a player in
CREATE POLICY "player can read round_players" ON round_players
  FOR SELECT USING (
    auth.uid() = user_id
    OR round_id IN (
      SELECT id FROM rounds
      WHERE players::jsonb @> ('[{"id":"' || auth.uid()::text || '"}]')::jsonb
    )
  );

-- Allow reading buy_ins for rounds you're a player in
CREATE POLICY "player can read buy_ins" ON buy_ins
  FOR SELECT USING (
    auth.uid() = user_id
    OR round_id IN (
      SELECT id FROM rounds
      WHERE players::jsonb @> ('[{"id":"' || auth.uid()::text || '"}]')::jsonb
    )
  );
