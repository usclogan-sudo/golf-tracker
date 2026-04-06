-- P0 Scalability: composite indexes for common query patterns
-- Safe to re-run (IF NOT EXISTS)

CREATE INDEX IF NOT EXISTS idx_hole_scores_round_player ON hole_scores(round_id, player_id);
CREATE INDEX IF NOT EXISTS idx_hole_scores_round_hole ON hole_scores(round_id, hole_number);
CREATE INDEX IF NOT EXISTS idx_settlements_round_status ON settlements(round_id, status);
CREATE INDEX IF NOT EXISTS idx_rounds_user_date ON rounds(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_buy_ins_round_player ON buy_ins(round_id, player_id);
CREATE INDEX IF NOT EXISTS idx_prop_wagers_round_user ON prop_wagers(round_id, user_id);
CREATE INDEX IF NOT EXISTS idx_round_participants_round_user ON round_participants(round_id, user_id);
