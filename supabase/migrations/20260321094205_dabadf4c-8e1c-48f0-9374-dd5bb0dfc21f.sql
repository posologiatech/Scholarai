
-- New table: survey_answer_audit (history of changes)
CREATE TABLE public.survey_answer_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id uuid NOT NULL REFERENCES public.survey_answers(id) ON DELETE CASCADE,
  previous_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_hash text,
  new_hash text,
  changed_by uuid NOT NULL,
  change_reason text NOT NULL,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS on survey_answer_audit: only survey owner can read
ALTER TABLE public.survey_answer_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Survey owners can view answer audit"
  ON public.survey_answer_audit FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.survey_answers sa
      JOIN public.survey_responses sr ON sr.id = sa.response_id
      JOIN public.surveys s ON s.id = sr.survey_id
      WHERE sa.id = survey_answer_audit.answer_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert answer audit"
  ON public.survey_answer_audit FOR INSERT
  TO public
  WITH CHECK (true);

-- Add integrity columns to survey_answers
ALTER TABLE public.survey_answers
  ADD COLUMN IF NOT EXISTS integrity_hash text,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_modified_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_modified_by uuid;

-- Add response_hash to survey_responses
ALTER TABLE public.survey_responses
  ADD COLUMN IF NOT EXISTS response_hash text;

-- UPDATE policy for survey_answers: only service_role can update
CREATE POLICY "Service role can update survey answers"
  ON public.survey_answers FOR UPDATE
  TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

-- UPDATE policy for survey_responses response_hash: only service_role
CREATE POLICY "Service role can update survey responses hash"
  ON public.survey_responses FOR UPDATE
  TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);
