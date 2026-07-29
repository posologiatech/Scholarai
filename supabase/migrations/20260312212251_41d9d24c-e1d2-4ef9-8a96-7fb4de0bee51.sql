
-- Study Participants (centrado no paciente)
CREATE TABLE public.study_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  participant_code TEXT NOT NULL,
  consent_signature_id UUID REFERENCES public.consent_signatures(id),
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own participants" ON public.study_participants FOR ALL USING (auth.uid() = user_id);

-- Study Visits (timepoints longitudinais)
CREATE TABLE public.study_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  visit_order INTEGER NOT NULL DEFAULT 0,
  target_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own visits" ON public.study_visits FOR ALL USING (auth.uid() = user_id);

-- Participant Documents
CREATE TABLE public.participant_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.study_participants(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES public.study_visits(id),
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.participant_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own documents" ON public.participant_documents FOR ALL USING (auth.uid() = user_id);

-- Storage bucket for study documents
INSERT INTO storage.buckets (id, name, public) VALUES ('study-documents', 'study-documents', false);
CREATE POLICY "Authenticated users can upload study docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'study-documents');
CREATE POLICY "Users can read own study docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'study-documents');
