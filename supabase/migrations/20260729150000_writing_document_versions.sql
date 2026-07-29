-- Version history for the Scientific Writing editor, mirroring research_overview_versions.
CREATE TABLE public.writing_document_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.writing_documents(id) ON DELETE CASCADE,
  author_id uuid,
  content text NOT NULL DEFAULT '',
  summary text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_writing_document_versions_document ON public.writing_document_versions(document_id, created_at DESC);

ALTER TABLE public.writing_document_versions ENABLE ROW LEVEL SECURITY;

-- writing_documents is single-owner (no project-member sharing), so versions follow the
-- same owner-only access as the document itself.
CREATE POLICY "Owners read versions"
ON public.writing_document_versions FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.writing_documents wd WHERE wd.id = writing_document_versions.document_id AND wd.user_id = auth.uid())
);

CREATE POLICY "Owners insert versions"
ON public.writing_document_versions FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.writing_documents wd WHERE wd.id = writing_document_versions.document_id AND wd.user_id = auth.uid())
);

CREATE POLICY "Owners delete versions"
ON public.writing_document_versions FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.writing_documents wd WHERE wd.id = writing_document_versions.document_id AND wd.user_id = auth.uid())
);
