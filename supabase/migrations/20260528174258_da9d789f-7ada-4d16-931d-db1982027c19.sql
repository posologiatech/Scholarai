
-- CRediT contributions per project member
CREATE TABLE public.research_credit_contributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.research_project_members(id) ON DELETE CASCADE,
  roles TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  is_corresponding BOOLEAN NOT NULL DEFAULT false,
  author_order INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, member_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_credit_contributions TO authenticated;
GRANT ALL ON public.research_credit_contributions TO service_role;

ALTER TABLE public.research_credit_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view credit"
ON public.research_credit_contributions FOR SELECT TO authenticated
USING (public.is_research_project_member(auth.uid(), project_id));

CREATE POLICY "managers insert credit"
ON public.research_credit_contributions FOR INSERT TO authenticated
WITH CHECK (public.is_research_project_manager(auth.uid(), project_id));

CREATE POLICY "managers update credit"
ON public.research_credit_contributions FOR UPDATE TO authenticated
USING (public.is_research_project_manager(auth.uid(), project_id));

CREATE POLICY "managers delete credit"
ON public.research_credit_contributions FOR DELETE TO authenticated
USING (public.is_research_project_manager(auth.uid(), project_id));

CREATE TRIGGER update_credit_updated_at
BEFORE UPDATE ON public.research_credit_contributions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Plataforma Brasil tracking on project
ALTER TABLE public.research_projects
  ADD COLUMN IF NOT EXISTS plataforma_brasil_caae TEXT,
  ADD COLUMN IF NOT EXISTS plataforma_brasil_url TEXT,
  ADD COLUMN IF NOT EXISTS folha_rosto_url TEXT,
  ADD COLUMN IF NOT EXISTS termo_sigilo_url TEXT;
