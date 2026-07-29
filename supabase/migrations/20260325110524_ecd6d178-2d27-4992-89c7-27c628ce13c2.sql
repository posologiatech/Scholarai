-- Table for research team members in surveys
CREATE TABLE public.survey_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'collaborator',
  added_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(survey_id, user_id)
);

ALTER TABLE public.survey_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Survey owners can manage team"
ON public.survey_team_members
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.surveys s
    WHERE s.id = survey_team_members.survey_id
    AND s.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.surveys s
    WHERE s.id = survey_team_members.survey_id
    AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Team members can view own membership"
ON public.survey_team_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Team members can view surveys they belong to"
ON public.surveys
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.survey_team_members stm
    WHERE stm.survey_id = surveys.id
    AND stm.user_id = auth.uid()
  )
);

CREATE POLICY "Team members can read survey questions"
ON public.survey_questions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.survey_team_members stm
    WHERE stm.survey_id = survey_questions.survey_id
    AND stm.user_id = auth.uid()
  )
);

CREATE POLICY "Team members can read survey blocks"
ON public.survey_blocks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.survey_team_members stm
    WHERE stm.survey_id = survey_blocks.survey_id
    AND stm.user_id = auth.uid()
  )
);

CREATE POLICY "Team members can manage participants"
ON public.study_participants
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.survey_team_members stm
    WHERE stm.survey_id = study_participants.survey_id
    AND stm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.survey_team_members stm
    WHERE stm.survey_id = study_participants.survey_id
    AND stm.user_id = auth.uid()
  )
);

CREATE POLICY "Team members can view responses"
ON public.survey_responses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.survey_team_members stm
    WHERE stm.survey_id = survey_responses.survey_id
    AND stm.user_id = auth.uid()
  )
);

CREATE POLICY "Team members can view answers"
ON public.survey_answers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM survey_responses r
    JOIN survey_team_members stm ON stm.survey_id = r.survey_id
    WHERE r.id = survey_answers.response_id
    AND stm.user_id = auth.uid()
  )
);