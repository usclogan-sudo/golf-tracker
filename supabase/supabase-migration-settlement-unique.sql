-- Add unique constraint to prevent duplicate settlement records
-- This prevents race conditions when multiple devices open SettleUp simultaneously

ALTER TABLE settlements
ADD CONSTRAINT settlements_unique_per_round
UNIQUE (round_id, from_player_id, to_player_id, source);
