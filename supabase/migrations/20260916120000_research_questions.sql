-- Research questions: ideas that are not yet a project.
--
-- A researcher often holds a question long before it has a team, a schedule or a method.
-- Keeping it as a row of its own (instead of a half-empty research_projects row) stops the
-- project list from filling with shells, and lets "turn into project" be an explicit step.
-- `project_id` records which project the question became, so the question stays findable
-- and the link survives; ON DELETE SET NULL because deleting the project must not delete
-- the researcher's original question.

CREATE TABLE public.research_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  question text NOT NULL CHECK (length(trim(question)) > 0),
  description text,
  category text CHECK (category IN ('ic','tcc','pos_graduacao','extensao','monitoria','outro')) DEFAULT 'outro',
  cnpq_area text,
  keywords text[] NOT NULL DEFAULT ARRAY[]::text[],
  project_id uuid REFERENCES public.research_projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_research_questions_owner
  ON public.research_questions (owner_id, created_at DESC);

ALTER TABLE public.research_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own research questions" ON public.research_questions
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER trg_research_questions_updated_at
  BEFORE UPDATE ON public.research_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
