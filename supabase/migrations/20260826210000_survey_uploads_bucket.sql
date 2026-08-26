-- Private bucket for respondent-provided files: the file_upload question type and the
-- signature question type both land here (path = <survey_id>/<uuid>-<filename>). Unlike
-- survey-branding/research-content, this bucket has NO public-read or anon-insert policy —
-- respondents are frequently unauthenticated, and per the 2026-05-30 decision to lock down
-- anon/public storage INSERT in favor of service-role edge functions, writes go exclusively
-- through supabase/functions/survey-upload (service role, re-validates the anonymous_token
-- and the survey's active status before writing). Only the survey's owner/workspace can read
-- what was uploaded, via a signed URL requested through their own authenticated session.
INSERT INTO storage.buckets (id, name, public) VALUES ('survey-uploads', 'survey-uploads', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "survey-uploads owner select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'survey-uploads' AND EXISTS (
      SELECT 1 FROM public.surveys s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND (s.user_id = auth.uid() OR (s.workspace_id IS NOT NULL AND public.is_workspace_member(auth.uid(), s.workspace_id)))
    )
  );

CREATE POLICY "survey-uploads owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'survey-uploads' AND EXISTS (
      SELECT 1 FROM public.surveys s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND (s.user_id = auth.uid() OR (s.workspace_id IS NOT NULL AND public.is_workspace_member(auth.uid(), s.workspace_id)))
    )
  );
