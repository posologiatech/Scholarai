-- Break recursive RLS dependency between surveys <-> survey_team_members
-- by using a SECURITY DEFINER function for ownership checks.

CREATE OR REPLACE FUNCTION public.is_survey_owner(_survey_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.surveys s
    WHERE s.id = _survey_id
      AND s.user_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "Survey owners can manage team" ON public.survey_team_members;

CREATE POLICY "Survey owners can manage team"
ON public.survey_team_members
FOR ALL
TO authenticated
USING (public.is_survey_owner(survey_id, auth.uid()))
WITH CHECK (public.is_survey_owner(survey_id, auth.uid()));