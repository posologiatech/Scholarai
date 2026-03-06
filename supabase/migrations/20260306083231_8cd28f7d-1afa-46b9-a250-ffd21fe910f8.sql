-- Allow anonymous users to read survey_distributions by token (for respondent form)
CREATE POLICY "Anyone can read distributions by token" ON public.survey_distributions
  FOR SELECT TO anon
  USING (type = 'anonymous_link');

-- Allow anonymous users to read survey details (for respondent form)
CREATE POLICY "Anyone can read active surveys" ON public.surveys
  FOR SELECT TO anon
  USING (status IN ('active', 'draft'));

-- Allow anonymous to read blocks/questions for responding
CREATE POLICY "Anyone can read survey blocks for responding" ON public.survey_blocks
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anyone can read survey questions for responding" ON public.survey_questions
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Anyone can read survey logic for responding" ON public.survey_logic_rules
  FOR SELECT TO anon
  USING (true);