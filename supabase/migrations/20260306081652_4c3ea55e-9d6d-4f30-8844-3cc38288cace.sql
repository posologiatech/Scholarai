
-- ============================================
-- SURVEY MODULE: All tables + RLS
-- ============================================

-- 1. surveys
CREATE TABLE public.surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Untitled Survey',
  description text,
  status text NOT NULL DEFAULT 'draft',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  closed_at timestamptz
);
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own surveys" ON public.surveys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own surveys" ON public.surveys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own surveys" ON public.surveys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own surveys" ON public.surveys FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Workspace members can view surveys" ON public.surveys FOR SELECT USING (workspace_id IS NOT NULL AND is_workspace_member(auth.uid(), workspace_id));

-- 2. survey_blocks
CREATE TABLE public.survey_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Block',
  description text,
  block_order integer NOT NULL DEFAULT 0,
  randomize_questions boolean NOT NULL DEFAULT false,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.survey_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own survey blocks" ON public.survey_blocks FOR ALL USING (
  EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_blocks.survey_id AND s.user_id = auth.uid())
);

-- 3. survey_questions
CREATE TABLE public.survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL REFERENCES public.survey_blocks(id) ON DELETE CASCADE,
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  question_type text NOT NULL DEFAULT 'multiple_choice',
  question_text text NOT NULL DEFAULT '',
  description text,
  question_order integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT false,
  validation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  choices jsonb NOT NULL DEFAULT '[]'::jsonb,
  matrix_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  matrix_columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own survey questions" ON public.survey_questions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_questions.survey_id AND s.user_id = auth.uid())
);

-- 4. survey_logic_rules
CREATE TABLE public.survey_logic_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  source_question_id uuid REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  source_block_id uuid REFERENCES public.survey_blocks(id) ON DELETE CASCADE,
  condition jsonb NOT NULL DEFAULT '{}'::jsonb,
  action text NOT NULL DEFAULT 'show_block',
  target_id uuid,
  rule_order integer NOT NULL DEFAULT 0
);
ALTER TABLE public.survey_logic_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own survey logic" ON public.survey_logic_rules FOR ALL USING (
  EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_logic_rules.survey_id AND s.user_id = auth.uid())
);

-- 5. survey_contacts
CREATE TABLE public.survey_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  first_name text,
  last_name text,
  email text NOT NULL,
  institution text,
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'not_sent',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.survey_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own survey contacts" ON public.survey_contacts FOR ALL USING (auth.uid() = user_id);

-- 6. survey_distributions
CREATE TABLE public.survey_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'anonymous_link',
  anonymous_token uuid DEFAULT gen_random_uuid(),
  email_subject text,
  email_body text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.survey_distributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own distributions" ON public.survey_distributions FOR ALL USING (auth.uid() = user_id);

-- 7. survey_responses (anonymous insert allowed via edge function)
CREATE TABLE public.survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  respondent_id text,
  contact_id uuid REFERENCES public.survey_contacts(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'in_progress',
  ip_address text,
  user_agent text,
  duration_seconds integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
-- Survey owners can read responses
CREATE POLICY "Survey owners can view responses" ON public.survey_responses FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_responses.survey_id AND s.user_id = auth.uid())
);
-- Service role can insert (for anonymous respondents via edge function)
CREATE POLICY "Service can insert responses" ON public.survey_responses FOR INSERT WITH CHECK (true);

-- 8. survey_answers
CREATE TABLE public.survey_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.survey_responses(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.survey_questions(id) ON DELETE CASCADE,
  answer_text text,
  answer_numeric numeric,
  answer_choices jsonb NOT NULL DEFAULT '[]'::jsonb,
  matrix_answers jsonb NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE public.survey_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Survey owners can view answers" ON public.survey_answers FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.survey_responses r
    JOIN public.surveys s ON s.id = r.survey_id
    WHERE r.id = survey_answers.response_id AND s.user_id = auth.uid()
  )
);
CREATE POLICY "Service can insert answers" ON public.survey_answers FOR INSERT WITH CHECK (true);

-- Trigger for updated_at on surveys
CREATE TRIGGER update_surveys_updated_at BEFORE UPDATE ON public.surveys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
