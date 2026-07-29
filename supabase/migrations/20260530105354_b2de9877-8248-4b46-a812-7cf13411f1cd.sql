ALTER TABLE public.research_meetings
  ADD COLUMN IF NOT EXISTS recurrence_freq text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_interval integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_weekdays integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recurrence_until date,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS parent_meeting_id uuid REFERENCES public.research_meetings(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_research_meetings_parent ON public.research_meetings(parent_meeting_id);
CREATE INDEX IF NOT EXISTS idx_research_meetings_scheduled ON public.research_meetings(scheduled_at);