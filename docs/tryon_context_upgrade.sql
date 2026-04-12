-- Migration: Link tryon_events to shopper context
ALTER TABLE tryon_events ADD COLUMN IF NOT EXISTS saved_result_id UUID REFERENCES saved_results(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tryon_events_saved_result_id ON tryon_events (saved_result_id);

-- Update RLS if necessary (though service_role usually bypasses this)
-- This ensures we can easily find which technical event belongs to which shopper journey.
