-- Lock down anonymous/public INSERT on service-fed tables (inserted only via service-role edge functions, which bypass RLS)
DROP POLICY IF EXISTS "Anyone can insert extraction cache" ON public.extraction_cache;
DROP POLICY IF EXISTS "Anyone can insert paper chunks" ON public.paper_chunks;
DROP POLICY IF EXISTS "Service role can insert answer audit" ON public.survey_answer_audit;

CREATE POLICY "Service can insert answer audit" ON public.survey_answer_audit
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- research-content (public bucket): restrict writes to project members; path = <project_id>/...
DROP POLICY IF EXISTS "research-content auth insert" ON storage.objects;
DROP POLICY IF EXISTS "research-content auth update" ON storage.objects;
DROP POLICY IF EXISTS "research-content auth delete" ON storage.objects;

CREATE POLICY "research-content member insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'research-content' AND EXISTS (
      SELECT 1 FROM public.research_projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND public.is_research_project_member(auth.uid(), p.id)
    )
  );

CREATE POLICY "research-content member update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'research-content' AND EXISTS (
      SELECT 1 FROM public.research_projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND public.is_research_project_member(auth.uid(), p.id)
    )
  );

CREATE POLICY "research-content member delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'research-content' AND EXISTS (
      SELECT 1 FROM public.research_projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND public.is_research_project_member(auth.uid(), p.id)
    )
  );

-- research-documents: restrict SELECT to owner's folder; path = <user_id>/<project_id>/...
DROP POLICY IF EXISTS "Auth users read research docs" ON storage.objects;

CREATE POLICY "Auth users read own research docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'research-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- study-documents: enforce owner folder on upload; path = <user_id>/...
DROP POLICY IF EXISTS "Authenticated users can upload study docs" ON storage.objects;

CREATE POLICY "Users can upload own study docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'study-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );