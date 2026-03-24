-- Add updated_at to hole_scores for conflict detection
ALTER TABLE hole_scores ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hole_scores_updated_at
  BEFORE UPDATE ON hole_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Backfill existing rows
UPDATE hole_scores SET updated_at = now() WHERE updated_at IS NULL;
