-- Lets an uploaded PDF (Writing Assistant's own upload, distinct from the Library's
-- reference manager) belong to a research project, so the Writing Assistant can scope
-- its Sources panel to only the current project's PDFs instead of every PDF the
-- researcher has ever uploaded across unrelated projects.
ALTER TABLE public.uploaded_papers
  ADD COLUMN research_project_id uuid REFERENCES public.research_projects(id) ON DELETE SET NULL;

CREATE INDEX idx_uploaded_papers_research_project ON public.uploaded_papers(research_project_id);
