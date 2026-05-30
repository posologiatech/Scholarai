ALTER TABLE public.research_schedule_items
  ADD COLUMN IF NOT EXISTS progress_mode text NOT NULL DEFAULT 'auto';

ALTER TABLE public.research_tasks
  ADD COLUMN IF NOT EXISTS schedule_item_id uuid REFERENCES public.research_schedule_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_research_tasks_schedule_item ON public.research_tasks(schedule_item_id);