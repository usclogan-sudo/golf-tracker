-- ═══════════════════════════════════════════════════════════════════════════════
-- Foreign Key Constraints Migration
-- Adds referential integrity to core tables that reference rounds, courses, etc.
-- All statements are idempotent (safe to run multiple times).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Helper: Add FK only if it doesn't already exist ─────────────────────────
-- (PostgreSQL doesn't have IF NOT EXISTS for constraints, so we use DO blocks)

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Child tables referencing rounds(id)
-- ═══════════════════════════════════════════════════════════════════════════════

-- hole_scores.round_id → rounds(id) ON DELETE CASCADE
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_hole_scores_round' AND table_name = 'hole_scores'
  ) THEN
    ALTER TABLE hole_scores ADD CONSTRAINT fk_hole_scores_round
      FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE;
  END IF;
END $$;

-- round_players.round_id → rounds(id) ON DELETE CASCADE
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_round_players_round' AND table_name = 'round_players'
  ) THEN
    ALTER TABLE round_players ADD CONSTRAINT fk_round_players_round
      FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE;
  END IF;
END $$;

-- buy_ins.round_id → rounds(id) ON DELETE CASCADE
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_buy_ins_round' AND table_name = 'buy_ins'
  ) THEN
    ALTER TABLE buy_ins ADD CONSTRAINT fk_buy_ins_round
      FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE;
  END IF;
END $$;

-- bbb_points.round_id → rounds(id) ON DELETE CASCADE
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_bbb_points_round' AND table_name = 'bbb_points'
  ) THEN
    ALTER TABLE bbb_points ADD CONSTRAINT fk_bbb_points_round
      FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE;
  END IF;
END $$;

-- settlements.round_id → rounds(id) ON DELETE CASCADE
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_settlements_round' AND table_name = 'settlements'
  ) THEN
    ALTER TABLE settlements ADD CONSTRAINT fk_settlements_round
      FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE;
  END IF;
END $$;

-- side_bets.round_id → rounds(id) ON DELETE CASCADE
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_side_bets_round' AND table_name = 'side_bets'
  ) THEN
    ALTER TABLE side_bets ADD CONSTRAINT fk_side_bets_round
      FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE;
  END IF;
END $$;

-- round_participants.round_id → rounds(id) ON DELETE CASCADE
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_round_participants_round' AND table_name = 'round_participants'
  ) THEN
    ALTER TABLE round_participants ADD CONSTRAINT fk_round_participants_round
      FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE;
  END IF;
END $$;

-- notifications.round_id → rounds(id) ON DELETE CASCADE (nullable)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_notifications_round' AND table_name = 'notifications'
  ) THEN
    ALTER TABLE notifications ADD CONSTRAINT fk_notifications_round
      FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. Tournament child tables
-- ═══════════════════════════════════════════════════════════════════════════════

-- tournament_rounds.tournament_id → tournaments(id) ON DELETE CASCADE
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tournament_rounds_tournament' AND table_name = 'tournament_rounds'
  ) THEN
    ALTER TABLE tournament_rounds ADD CONSTRAINT fk_tournament_rounds_tournament
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- tournament_matchups.tournament_id → tournaments(id) ON DELETE CASCADE
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tournament_matchups_tournament' AND table_name = 'tournament_matchups'
  ) THEN
    ALTER TABLE tournament_matchups ADD CONSTRAINT fk_tournament_matchups_tournament
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. Events
-- ═══════════════════════════════════════════════════════════════════════════════

-- events.round_id → rounds(id) ON DELETE SET NULL (nullable link)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_events_round' AND table_name = 'events'
  ) THEN
    ALTER TABLE events ADD CONSTRAINT fk_events_round
      FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. Note on junk_records
-- ═══════════════════════════════════════════════════════════════════════════════
-- junk_records was created in Phase 5 with:
--   round_id uuid REFERENCES rounds(id) NOT NULL
-- This FK already exists. However, the rounds table uses text PKs, not uuid.
-- If this FK is failing due to type mismatch, the column type was likely
-- adapted during initial setup. No action needed if already working.

-- ═══════════════════════════════════════════════════════════════════════════════
-- Done. All child tables now have FK constraints with CASCADE delete,
-- ensuring orphaned rows cannot exist.
-- ═══════════════════════════════════════════════════════════════════════════════
