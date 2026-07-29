
-- Phase 2: Compliance, Budget, Ethics

-- 1. Generated/managed documents (TCLE, DMP, partial/final reports, custom)
CREATE TABLE public.research_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('tcle','tale','dmp','relatorio_parcial','relatorio_final','folha_rosto','termo_sigilo','custom')),
  title TEXT NOT NULL,
  content TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','em_revisao','aprovado','arquivado')),
  file_url TEXT,
  generated_by_ai BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_research_documents_project ON public.research_documents(project_id);
ALTER TABLE public.research_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view documents" ON public.research_documents
  FOR SELECT USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Members can insert documents" ON public.research_documents
  FOR INSERT WITH CHECK (public.is_research_project_member(auth.uid(), project_id) AND auth.uid() = created_by);
CREATE POLICY "Members can update documents" ON public.research_documents
  FOR UPDATE USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Managers or author can delete documents" ON public.research_documents
  FOR DELETE USING (public.is_research_project_manager(auth.uid(), project_id) OR auth.uid() = created_by);

CREATE TRIGGER trg_research_documents_updated
  BEFORE UPDATE ON public.research_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Budget items (planned rubricas)
CREATE TABLE public.research_budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  rubrica TEXT NOT NULL CHECK (rubrica IN ('custeio','capital','bolsa','diaria','passagem','servico_terceiros','outros')),
  description TEXT NOT NULL,
  planned_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  funder TEXT,
  period_start DATE,
  period_end DATE,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_budget_items_project ON public.research_budget_items(project_id);
ALTER TABLE public.research_budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view budget" ON public.research_budget_items
  FOR SELECT USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Managers manage budget" ON public.research_budget_items
  FOR ALL USING (public.is_research_project_manager(auth.uid(), project_id))
  WITH CHECK (public.is_research_project_manager(auth.uid(), project_id));

CREATE TRIGGER trg_budget_items_updated
  BEFORE UPDATE ON public.research_budget_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Expenses (execucao)
CREATE TABLE public.research_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  budget_item_id UUID REFERENCES public.research_budget_items(id) ON DELETE SET NULL,
  expense_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  supplier TEXT,
  description TEXT NOT NULL,
  invoice_number TEXT,
  invoice_url TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado','reembolsado')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_project ON public.research_expenses(project_id);
CREATE INDEX idx_expenses_budget_item ON public.research_expenses(budget_item_id);
ALTER TABLE public.research_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view expenses" ON public.research_expenses
  FOR SELECT USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Members insert expenses" ON public.research_expenses
  FOR INSERT WITH CHECK (public.is_research_project_member(auth.uid(), project_id) AND auth.uid() = created_by);
CREATE POLICY "Managers or author update expenses" ON public.research_expenses
  FOR UPDATE USING (public.is_research_project_manager(auth.uid(), project_id) OR auth.uid() = created_by);
CREATE POLICY "Managers or author delete expenses" ON public.research_expenses
  FOR DELETE USING (public.is_research_project_manager(auth.uid(), project_id) OR auth.uid() = created_by);

CREATE TRIGGER trg_expenses_updated
  BEFORE UPDATE ON public.research_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Ethics submissions (CEP/CONEP)
CREATE TABLE public.research_ethics_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  submission_type TEXT NOT NULL CHECK (submission_type IN ('inicial','emenda','relatorio_parcial','relatorio_final','recurso')),
  title TEXT NOT NULL,
  protocol_number TEXT,
  caae TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','submetido','em_analise','pendencias','aprovado','reprovado','arquivado')),
  submitted_at DATE,
  decision_date DATE,
  reviewer_notes TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ethics_project ON public.research_ethics_submissions(project_id);
ALTER TABLE public.research_ethics_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view ethics" ON public.research_ethics_submissions
  FOR SELECT USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Managers manage ethics" ON public.research_ethics_submissions
  FOR ALL USING (public.is_research_project_manager(auth.uid(), project_id))
  WITH CHECK (public.is_research_project_manager(auth.uid(), project_id));

CREATE TRIGGER trg_ethics_updated
  BEFORE UPDATE ON public.research_ethics_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Ethics attachments
CREATE TABLE public.research_ethics_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.research_ethics_submissions(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ethics_attach_submission ON public.research_ethics_attachments(submission_id);
ALTER TABLE public.research_ethics_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view ethics attach" ON public.research_ethics_attachments
  FOR SELECT USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Members insert ethics attach" ON public.research_ethics_attachments
  FOR INSERT WITH CHECK (public.is_research_project_member(auth.uid(), project_id) AND auth.uid() = uploaded_by);
CREATE POLICY "Managers or uploader delete ethics attach" ON public.research_ethics_attachments
  FOR DELETE USING (public.is_research_project_manager(auth.uid(), project_id) OR auth.uid() = uploaded_by);

-- 6. Storage bucket for research compliance docs
INSERT INTO storage.buckets (id, name, public)
VALUES ('research-documents', 'research-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth users read research docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'research-documents');
CREATE POLICY "Auth users upload research docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'research-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Auth users update own research docs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'research-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Auth users delete own research docs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'research-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
