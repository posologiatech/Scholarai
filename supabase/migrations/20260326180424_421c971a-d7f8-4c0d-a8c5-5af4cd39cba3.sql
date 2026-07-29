
DROP POLICY IF EXISTS "Anyone can read consents for responding" ON public.study_consents;

CREATE POLICY "Anyone can read consents for active surveys"
ON public.study_consents
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.surveys s
    WHERE s.id = study_consents.survey_id
      AND s.status = 'active'
  )
);
