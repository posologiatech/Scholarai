
-- Create screening_decisions table for dual screening
CREATE TABLE public.screening_decisions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES public.systematic_reviews(id) ON DELETE CASCADE,
  paper_id text NOT NULL,
  user_id uuid NOT NULL,
  decision text NOT NULL DEFAULT 'pending', -- include, exclude, maybe, pending
  criteria_results jsonb NOT NULL DEFAULT '{}'::jsonb,
  inclusion_score real DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(review_id, paper_id, user_id)
);

-- Enable RLS
ALTER TABLE public.screening_decisions ENABLE ROW LEVEL SECURITY;

-- Policies: users can manage their own decisions, and view decisions for reviews they own
CREATE POLICY "Users can insert own screening decisions"
ON public.screening_decisions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own screening decisions"
ON public.screening_decisions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own screening decisions"
ON public.screening_decisions
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can view screening decisions for their reviews"
ON public.screening_decisions
FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.systematic_reviews sr
    WHERE sr.id = screening_decisions.review_id AND sr.user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_screening_decisions_updated_at
BEFORE UPDATE ON public.screening_decisions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
