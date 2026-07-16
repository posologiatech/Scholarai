ALTER TABLE public.research_schedule_items ADD COLUMN IF NOT EXISTS assignee_ids uuid[] NOT NULL DEFAULT '{}';
-- Backfill from legacy single assignee_id
UPDATE public.research_schedule_items
  SET assignee_ids = ARRAY[assignee_id]
  WHERE assignee_id IS NOT NULL AND (assignee_ids IS NULL OR array_length(assignee_ids,1) IS NULL);