-- Discover history: instead of hard-deleting rotated-out items,
-- refresh-discover-feed now soft-archives them (sets archived_at).
-- The live /discover feed filters archived_at IS NULL; the new
-- /discover/history timeline shows everything, archived or not.
ALTER TABLE public.discover_items ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_discover_items_archived_at ON public.discover_items (archived_at);
