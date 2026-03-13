
-- 1. Audit log table
CREATE TABLE public.study_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES public.study_participants(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  actor_id UUID,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_audit_log ENABLE ROW LEVEL SECURITY;

-- Researchers can view audit logs for their surveys
CREATE POLICY "Survey owners can view audit logs"
  ON public.study_audit_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.surveys s WHERE s.id = study_audit_log.survey_id AND s.user_id = auth.uid()
  ));

-- Edge functions (service role via anon with no JWT) can insert
CREATE POLICY "Anyone can insert audit logs"
  ON public.study_audit_log FOR INSERT
  WITH CHECK (true);

-- 2. Add versioning to study_consents
ALTER TABLE public.study_consents
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- 3. Add consent_version and revocation fields to consent_signatures
ALTER TABLE public.consent_signatures
  ADD COLUMN IF NOT EXISTS consent_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revocation_reason TEXT;

-- 4. Allow update on consent_signatures for revocation
CREATE POLICY "Allow revocation updates on consent signatures"
  ON public.consent_signatures FOR UPDATE
  USING (true)
  WITH CHECK (true);
