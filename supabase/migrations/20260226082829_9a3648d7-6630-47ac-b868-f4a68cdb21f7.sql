CREATE TABLE public.systematic_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  research_question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  auto_suggestions BOOLEAN NOT NULL DEFAULT true,
  papers JSONB NOT NULL DEFAULT '[]'::jsonb,
  screening_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  screening_results JSONB NOT NULL DEFAULT '{}'::jsonb,
  extraction_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  extraction_results JSONB NOT NULL DEFAULT '{}'::jsonb,
  included_paper_ids TEXT[] NOT NULL DEFAULT '{}',
  report_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.systematic_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own systematic reviews"
  ON public.systematic_reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own systematic reviews"
  ON public.systematic_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own systematic reviews"
  ON public.systematic_reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own systematic reviews"
  ON public.systematic_reviews FOR DELETE
  USING (auth.uid() = user_id);