-- 9-Hole Mode + Shotgun Start
-- Adds holes_mode, starting_hole, and shotgun_starts columns to rounds table.
-- All columns are optional with backward-compatible defaults.

ALTER TABLE rounds ADD COLUMN IF NOT EXISTS holes_mode text DEFAULT 'full_18';
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS starting_hole int DEFAULT 1;
ALTER TABLE rounds ADD COLUMN IF NOT EXISTS shotgun_starts jsonb;
