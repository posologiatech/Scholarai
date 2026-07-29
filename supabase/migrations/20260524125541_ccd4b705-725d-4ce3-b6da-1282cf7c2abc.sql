
-- 1. consent_signatures + consents bucket
DROP POLICY IF EXISTS "Anyone can insert consent signatures" ON public.consent_signatures;
DROP POLICY IF EXISTS "Anyone can upload consent PDFs" ON storage.objects;

-- 2. illustrations table + bucket
DROP POLICY IF EXISTS "Service can insert illustrations" ON public.illustrations;
CREATE POLICY "Service role can insert illustrations"
ON public.illustrations FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can upload illustrations" ON storage.objects;
DROP POLICY IF EXISTS "Service can upload illustrations" ON storage.objects;
CREATE POLICY "Service role can upload illustrations"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'illustrations');

-- 3. survey_responses / survey_answers
DROP POLICY IF EXISTS "Service can insert responses" ON public.survey_responses;
DROP POLICY IF EXISTS "Service can insert answers" ON public.survey_answers;
CREATE POLICY "Service role inserts survey responses"
ON public.survey_responses FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Service role inserts survey answers"
ON public.survey_answers FOR INSERT TO service_role WITH CHECK (true);

-- 4. survey blocks/questions/logic restricted to active surveys
DROP POLICY IF EXISTS "Anyone can read survey blocks for responding" ON public.survey_blocks;
CREATE POLICY "Anon reads blocks of active surveys"
ON public.survey_blocks FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_blocks.survey_id AND s.status = 'active'));

DROP POLICY IF EXISTS "Anyone can read survey questions for responding" ON public.survey_questions;
CREATE POLICY "Anon reads questions of active surveys"
ON public.survey_questions FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.survey_blocks b JOIN public.surveys s ON s.id = b.survey_id
  WHERE b.id = survey_questions.block_id AND s.status = 'active'
));

DROP POLICY IF EXISTS "Anyone can read survey logic for responding" ON public.survey_logic_rules;
CREATE POLICY "Anon reads logic of active surveys"
ON public.survey_logic_rules FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_logic_rules.survey_id AND s.status = 'active'));

-- 5. survey_distributions: drop anon SELECT, expose token-bound RPC
DROP POLICY IF EXISTS "Anyone can read distributions by token" ON public.survey_distributions;

DROP FUNCTION IF EXISTS public.get_distribution_by_token(text);
CREATE OR REPLACE FUNCTION public.get_distribution_by_token(_token uuid)
RETURNS TABLE (
  id uuid,
  survey_id uuid,
  type text,
  anonymous_token uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.survey_id, d.type::text, d.anonymous_token
  FROM public.survey_distributions d
  JOIN public.surveys s ON s.id = d.survey_id
  WHERE d.type = 'anonymous_link'
    AND d.anonymous_token = _token
    AND s.status = 'active'
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_distribution_by_token(uuid) TO anon, authenticated;

-- 6. study-documents storage owner-scoped UPDATE/DELETE
DROP POLICY IF EXISTS "Owner can update study documents" ON storage.objects;
DROP POLICY IF EXISTS "Owner can delete study documents" ON storage.objects;
CREATE POLICY "Owner can update study documents"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'study-documents' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'study-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owner can delete study documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'study-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
