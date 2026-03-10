-- Phase 5: Junk side bets + Multi-device realtime
-- Run this in your Supabase SQL editor

-- ═══════════════════════════════════════════════════════════════════
-- Part A: Junk side bets
-- ═══════════════════════════════════════════════════════════════════

-- Add junk_config JSONB column to rounds table
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS junk_config jsonb;

-- Create junk_records table
CREATE TABLE IF NOT EXISTS junk_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  round_id uuid REFERENCES rounds(id) NOT NULL,
  hole_number int NOT NULL CHECK (hole_number >= 1 AND hole_number <= 18),
  player_id text NOT NULL,
  junk_type text NOT NULL CHECK (junk_type IN ('sandy', 'greenie', 'snake', 'barkie', 'ctp')),
  created_at timestamptz DEFAULT now()
);

-- RLS policy
ALTER TABLE junk_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own junk records" ON junk_records
  FOR ALL USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_junk_records_round ON junk_records(round_id);

-- ═══════════════════════════════════════════════════════════════════
-- Part B: Enable Supabase Realtime for live sync
-- ═══════════════════════════════════════════════════════════════════

-- Enable realtime on the tables used during scoring
ALTER PUBLICATION supabase_realtime ADD TABLE hole_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE bbb_points;
ALTER PUBLICATION supabase_realtime ADD TABLE junk_records;
ALTER PUBLICATION supabase_realtime ADD TABLE rounds;
