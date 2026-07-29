ALTER TABLE public.research_meetings
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativa';