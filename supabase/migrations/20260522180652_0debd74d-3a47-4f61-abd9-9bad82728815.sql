
-- 1) ai_usage_log: restrict SELECT
DROP POLICY IF EXISTS "Service role can read" ON public.ai_usage_log;
CREATE POLICY "Users can read own usage logs"
  ON public.ai_usage_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- 2) consent_signatures: restrict UPDATE to survey owner / service role
DROP POLICY IF EXISTS "Allow revocation updates on consent signatures" ON public.consent_signatures;
CREATE POLICY "Survey owners or service can update consent signatures"
  ON public.consent_signatures FOR UPDATE
  USING (
    auth.role() = 'service_role' OR EXISTS (
      SELECT 1 FROM public.study_consents sc
      JOIN public.surveys s ON s.id = sc.survey_id
      WHERE sc.id = consent_signatures.consent_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role' OR EXISTS (
      SELECT 1 FROM public.study_consents sc
      JOIN public.surveys s ON s.id = sc.survey_id
      WHERE sc.id = consent_signatures.consent_id AND s.user_id = auth.uid()
    )
  );

-- 3) study_audit_log: restrict INSERT
DROP POLICY IF EXISTS "Anyone can insert audit logs" ON public.study_audit_log;
CREATE POLICY "Authenticated or service can insert audit logs"
  ON public.study_audit_log FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND (actor_id IS NULL OR actor_id = auth.uid()))
  );

-- 4) Storage: consents bucket — verify survey ownership via signature
DROP POLICY IF EXISTS "Survey owners can read consent files" ON storage.objects;
CREATE POLICY "Survey owners can read consent files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'consents' AND EXISTS (
      SELECT 1 FROM public.consent_signatures cs
      JOIN public.study_consents sc ON sc.id = cs.consent_id
      JOIN public.surveys s ON s.id = sc.survey_id
      WHERE cs.pdf_path = storage.objects.name AND s.user_id = auth.uid()
    )
  );

-- 5) Storage: datamind-files — folder ownership
DROP POLICY IF EXISTS "Users can view own datamind files" ON storage.objects;
CREATE POLICY "Users can view own datamind files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'datamind-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own datamind files" ON storage.objects;
CREATE POLICY "Users can delete own datamind files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'datamind-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can upload datamind files" ON storage.objects;
CREATE POLICY "Users can upload datamind files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'datamind-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 6) Storage: study-documents — folder ownership
DROP POLICY IF EXISTS "Users can read own study docs" ON storage.objects;
CREATE POLICY "Users can read own study docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'study-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
