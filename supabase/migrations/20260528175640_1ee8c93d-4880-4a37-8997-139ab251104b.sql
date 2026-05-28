
-- Pillar 5: Funding link + expense OCR fields
ALTER TABLE public.research_projects
  ADD COLUMN IF NOT EXISTS funding_call_id uuid REFERENCES public.funding_calls(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS funder_template text;

ALTER TABLE public.research_expenses
  ADD COLUMN IF NOT EXISTS ocr_text text,
  ADD COLUMN IF NOT EXISTS ocr_data jsonb,
  ADD COLUMN IF NOT EXISTS suggested_rubrica text;

-- Pillar 6: Outputs vitrine
CREATE TABLE IF NOT EXISTS public.research_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'dataset', -- dataset | code | patent | media | software | protocol | other
  title text NOT NULL,
  description text,
  url text,
  doi text,
  repository text, -- e.g. GitHub, Zenodo, Figshare
  license text,
  release_date date,
  authors jsonb DEFAULT '[]'::jsonb,
  tags text[] DEFAULT ARRAY[]::text[],
  metrics jsonb DEFAULT '{}'::jsonb, -- views, downloads, citations
  is_public boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_outputs TO authenticated;
GRANT SELECT ON public.research_outputs TO anon;
GRANT ALL ON public.research_outputs TO service_role;

ALTER TABLE public.research_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view outputs"
  ON public.research_outputs FOR SELECT TO authenticated
  USING (public.is_research_project_member(auth.uid(), project_id));

CREATE POLICY "Public can view public outputs of public projects"
  ON public.research_outputs FOR SELECT TO anon
  USING (
    is_public = true AND EXISTS (
      SELECT 1 FROM public.research_projects p
      WHERE p.id = research_outputs.project_id AND p.is_public = true
    )
  );

CREATE POLICY "Members can insert outputs"
  ON public.research_outputs FOR INSERT TO authenticated
  WITH CHECK (public.is_research_project_member(auth.uid(), project_id));

CREATE POLICY "Members can update outputs"
  ON public.research_outputs FOR UPDATE TO authenticated
  USING (public.is_research_project_member(auth.uid(), project_id));

CREATE POLICY "Members can delete outputs"
  ON public.research_outputs FOR DELETE TO authenticated
  USING (public.is_research_project_member(auth.uid(), project_id));

CREATE TRIGGER trg_research_outputs_updated_at
  BEFORE UPDATE ON public.research_outputs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_research_outputs_project ON public.research_outputs(project_id);
