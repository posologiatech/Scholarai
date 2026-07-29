
-- 1. Logbook (Diário de Bordo)
CREATE TABLE public.research_logbook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('progresso','hipotese','decisao','dificuldade','leitura','experimento','outro')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  signed_at TIMESTAMPTZ,
  signature_hash TEXT,
  countersigned_by UUID,
  countersigned_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','assinado','contra_assinado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_logbook_project ON public.research_logbook_entries(project_id);
CREATE INDEX idx_logbook_author ON public.research_logbook_entries(author_id);
ALTER TABLE public.research_logbook_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read logbook" ON public.research_logbook_entries
  FOR SELECT USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Members insert own logbook" ON public.research_logbook_entries
  FOR INSERT WITH CHECK (public.is_research_project_member(auth.uid(), project_id) AND auth.uid() = author_id);
CREATE POLICY "Author or manager update logbook" ON public.research_logbook_entries
  FOR UPDATE USING (auth.uid() = author_id OR public.is_research_project_manager(auth.uid(), project_id));
CREATE POLICY "Author or manager delete logbook" ON public.research_logbook_entries
  FOR DELETE USING (auth.uid() = author_id OR public.is_research_project_manager(auth.uid(), project_id));

CREATE TRIGGER trg_logbook_updated BEFORE UPDATE ON public.research_logbook_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Milestone evaluations (Avaliação por Marcos)
CREATE TABLE public.research_milestone_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  advisee_id UUID REFERENCES public.research_advisees(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.research_tasks(id) ON DELETE SET NULL,
  schedule_item_id UUID REFERENCES public.research_schedule_items(id) ON DELETE SET NULL,
  evaluator_id UUID NOT NULL,
  evaluatee_id UUID,
  title TEXT NOT NULL,
  score NUMERIC(3,1) CHECK (score >= 0 AND score <= 10),
  comments TEXT,
  evaluated_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mileval_project ON public.research_milestone_evaluations(project_id);
ALTER TABLE public.research_milestone_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read evaluations" ON public.research_milestone_evaluations
  FOR SELECT USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Managers manage evaluations" ON public.research_milestone_evaluations
  FOR ALL USING (public.is_research_project_manager(auth.uid(), project_id))
  WITH CHECK (public.is_research_project_manager(auth.uid(), project_id));

CREATE TRIGGER trg_mileval_updated BEFORE UPDATE ON public.research_milestone_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Extend publications with enrichment fields
ALTER TABLE public.research_publications
  ADD COLUMN IF NOT EXISTS openalex_id TEXT,
  ADD COLUMN IF NOT EXISTS citations_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS altmetric_score NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS altmetric_url TEXT,
  ADD COLUMN IF NOT EXISTS orcid_put_code TEXT,
  ADD COLUMN IF NOT EXISTS authors TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS abstract TEXT,
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;
