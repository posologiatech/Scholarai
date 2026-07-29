-- Optional project linkage on module entities
ALTER TABLE public.datamind_conversations ADD COLUMN IF NOT EXISTS research_project_id uuid REFERENCES public.research_projects(id) ON DELETE SET NULL;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS research_project_id uuid REFERENCES public.research_projects(id) ON DELETE SET NULL;
ALTER TABLE public.writing_documents ADD COLUMN IF NOT EXISTS research_project_id uuid REFERENCES public.research_projects(id) ON DELETE SET NULL;
ALTER TABLE public.systematic_reviews ADD COLUMN IF NOT EXISTS research_project_id uuid REFERENCES public.research_projects(id) ON DELETE SET NULL;
ALTER TABLE public.saved_searches ADD COLUMN IF NOT EXISTS research_project_id uuid REFERENCES public.research_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_datamind_conv_project ON public.datamind_conversations(research_project_id);
CREATE INDEX IF NOT EXISTS idx_surveys_project ON public.surveys(research_project_id);
CREATE INDEX IF NOT EXISTS idx_writing_docs_project ON public.writing_documents(research_project_id);
CREATE INDEX IF NOT EXISTS idx_systematic_reviews_project ON public.systematic_reviews(research_project_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_project ON public.saved_searches(research_project_id);

-- Central links table
CREATE TABLE public.research_project_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  resource_id text,
  label text,
  url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_research_project_links_project ON public.research_project_links(project_id);
CREATE INDEX idx_research_project_links_type ON public.research_project_links(project_id, resource_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_project_links TO authenticated;
GRANT ALL ON public.research_project_links TO service_role;

ALTER TABLE public.research_project_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view project links"
ON public.research_project_links FOR SELECT TO authenticated
USING (public.is_research_project_member(auth.uid(), project_id));

CREATE POLICY "Members can create project links"
ON public.research_project_links FOR INSERT TO authenticated
WITH CHECK (public.is_research_project_member(auth.uid(), project_id) AND created_by = auth.uid());

CREATE POLICY "Members can update project links"
ON public.research_project_links FOR UPDATE TO authenticated
USING (public.is_research_project_member(auth.uid(), project_id));

CREATE POLICY "Members can delete project links"
ON public.research_project_links FOR DELETE TO authenticated
USING (public.is_research_project_member(auth.uid(), project_id));

CREATE TRIGGER update_research_project_links_updated_at
BEFORE UPDATE ON public.research_project_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();