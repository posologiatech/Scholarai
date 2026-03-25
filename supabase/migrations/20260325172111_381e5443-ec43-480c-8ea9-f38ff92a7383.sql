-- Create SECURITY DEFINER function for team membership checks
CREATE OR REPLACE FUNCTION public.is_survey_team_member(_survey_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.survey_team_members
    WHERE survey_id = _survey_id
      AND user_id = _user_id
  );
$$;

-- Fix surveys: "Team members can view surveys they belong to"
DROP POLICY IF EXISTS "Team members can view surveys they belong to" ON public.surveys;
CREATE POLICY "Team members can view surveys they belong to"
ON public.surveys
FOR SELECT
TO authenticated
USING (public.is_survey_team_member(id, auth.uid()));

-- Fix survey_questions: "Team members can read survey questions"
DROP POLICY IF EXISTS "Team members can read survey questions" ON public.survey_questions;
CREATE POLICY "Team members can read survey questions"
ON public.survey_questions
FOR SELECT
TO authenticated
USING (public.is_survey_team_member(survey_id, auth.uid()));

-- Fix survey_blocks: "Team members can read survey blocks"
DROP POLICY IF EXISTS "Team members can read survey blocks" ON public.survey_blocks;
CREATE POLICY "Team members can read survey blocks"
ON public.survey_blocks
FOR SELECT
TO authenticated
USING (public.is_survey_team_member(survey_id, auth.uid()));

-- Fix study_participants: "Team members can manage participants"
DROP POLICY IF EXISTS "Team members can manage participants" ON public.study_participants;
CREATE POLICY "Team members can manage participants"
ON public.study_participants
FOR ALL
TO authenticated
USING (public.is_survey_team_member(survey_id, auth.uid()))
WITH CHECK (public.is_survey_team_member(survey_id, auth.uid()));

-- Fix survey_responses: "Team members can view responses"
DROP POLICY IF EXISTS "Team members can view responses" ON public.survey_responses;
CREATE POLICY "Team members can view responses"
ON public.survey_responses
FOR SELECT
TO authenticated
USING (public.is_survey_team_member(survey_id, auth.uid()));

-- Fix survey_answers: "Team members can view answers" (uses join through responses)
DROP POLICY IF EXISTS "Team members can view answers" ON public.survey_answers;
CREATE POLICY "Team members can view answers"
ON public.survey_answers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.survey_responses r
    WHERE r.id = survey_answers.response_id
      AND public.is_survey_team_member(r.survey_id, auth.uid())
  )
);

-- Also fix the owner-checking policies on survey_blocks, survey_questions, survey_logic_rules
-- to use the SECURITY DEFINER function to avoid potential cascading issues
DROP POLICY IF EXISTS "Users can manage own survey blocks" ON public.survey_blocks;
CREATE POLICY "Users can manage own survey blocks"
ON public.survey_blocks
FOR ALL
TO public
USING (public.is_survey_owner(survey_id, auth.uid()));

DROP POLICY IF EXISTS "Users can manage own survey questions" ON public.survey_questions;
CREATE POLICY "Users can manage own survey questions"
ON public.survey_questions
FOR ALL
TO public
USING (public.is_survey_owner(survey_id, auth.uid()));

DROP POLICY IF EXISTS "Users can manage own survey logic" ON public.survey_logic_rules;
CREATE POLICY "Users can manage own survey logic"
ON public.survey_logic_rules
FOR ALL
TO public
USING (public.is_survey_owner(survey_id, auth.uid()));