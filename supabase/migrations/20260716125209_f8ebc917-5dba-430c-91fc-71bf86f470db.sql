
ALTER TABLE public.research_schedule_items
  ADD COLUMN IF NOT EXISTS start_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_reminder_sent_at timestamptz;
