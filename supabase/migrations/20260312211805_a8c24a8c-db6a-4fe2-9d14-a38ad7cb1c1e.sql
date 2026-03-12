
-- Study Consents (TCLE templates)
CREATE TABLE public.study_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'TCLE',
  sections JSONB NOT NULL DEFAULT '[]',
  video_url TEXT,
  audio_url TEXT,
  require_signature BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own consents" ON public.study_consents FOR ALL USING (auth.uid() = user_id);

-- Consent Signatures
CREATE TABLE public.consent_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id UUID NOT NULL REFERENCES public.study_consents(id) ON DELETE CASCADE,
  respondent_name TEXT NOT NULL,
  respondent_email TEXT,
  signature_data TEXT,
  ip_address TEXT,
  user_agent TEXT,
  section_confirmations JSONB NOT NULL DEFAULT '[]',
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  pdf_path TEXT
);

ALTER TABLE public.consent_signatures ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public respondents)
CREATE POLICY "Anyone can insert consent signatures" ON public.consent_signatures FOR INSERT WITH CHECK (true);

-- Survey owners can view signatures
CREATE POLICY "Survey owners can view consent signatures" ON public.consent_signatures FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.study_consents sc
    JOIN public.surveys s ON s.id = sc.survey_id
    WHERE sc.id = consent_signatures.consent_id AND s.user_id = auth.uid()
  )
);

-- Anyone can read consents for responding (anon)
CREATE POLICY "Anyone can read consents for responding" ON public.study_consents FOR SELECT TO anon USING (true);

-- Storage bucket for consent PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('consents', 'consents', false);

-- Storage policy: anyone can upload consent PDFs
CREATE POLICY "Anyone can upload consent PDFs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'consents');

-- Survey owners can read consent files
CREATE POLICY "Survey owners can read consent files" ON storage.objects FOR SELECT USING (bucket_id = 'consents');
