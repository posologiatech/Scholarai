-- Real-time co-editing support for writing_documents. Prerequisite gap: the document was
-- single-owner only (no RLS access for other project members at all), so "co-editing" had
-- no one to co-edit with. Extend access to project members, reusing the existing
-- is_research_project_member() SECURITY DEFINER helper (already used the same way across
-- research_tasks/research_meetings/research_publications — no new recursion risk, since that
-- helper only reads research_projects/research_project_members, never writing_documents).

ALTER TABLE public.writing_documents
  ADD COLUMN yjs_state bytea;

CREATE POLICY "Project members can view shared writing documents"
ON public.writing_documents
FOR SELECT
USING (
  research_project_id IS NOT NULL
  AND public.is_research_project_member(auth.uid(), research_project_id)
);

CREATE POLICY "Project members can update shared writing documents"
ON public.writing_documents
FOR UPDATE
USING (
  research_project_id IS NOT NULL
  AND public.is_research_project_member(auth.uid(), research_project_id)
)
WITH CHECK (
  research_project_id IS NOT NULL
  AND public.is_research_project_member(auth.uid(), research_project_id)
);

-- Version history follows the same sharing: members can read/snapshot, only the owner deletes.
CREATE POLICY "Project members can view shared document versions"
ON public.writing_document_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.writing_documents wd
    WHERE wd.id = writing_document_versions.document_id
      AND wd.research_project_id IS NOT NULL
      AND public.is_research_project_member(auth.uid(), wd.research_project_id)
  )
);

CREATE POLICY "Project members can insert shared document versions"
ON public.writing_document_versions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.writing_documents wd
    WHERE wd.id = writing_document_versions.document_id
      AND wd.research_project_id IS NOT NULL
      AND public.is_research_project_member(auth.uid(), wd.research_project_id)
  )
);
