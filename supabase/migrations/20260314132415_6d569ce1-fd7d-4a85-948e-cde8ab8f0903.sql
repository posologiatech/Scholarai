
-- Campos para co-assinatura do pesquisador
ALTER TABLE public.consent_signatures ADD COLUMN IF NOT EXISTS researcher_name TEXT;
ALTER TABLE public.consent_signatures ADD COLUMN IF NOT EXISTS researcher_signed_at TIMESTAMPTZ;
ALTER TABLE public.consent_signatures ADD COLUMN IF NOT EXISTS researcher_ip TEXT;

-- Campos de contato do pesquisador no TCLE
ALTER TABLE public.study_consents ADD COLUMN IF NOT EXISTS researcher_name TEXT;
ALTER TABLE public.study_consents ADD COLUMN IF NOT EXISTS researcher_email TEXT;
ALTER TABLE public.study_consents ADD COLUMN IF NOT EXISTS researcher_phone TEXT;
ALTER TABLE public.study_consents ADD COLUMN IF NOT EXISTS contact_hours TEXT;
ALTER TABLE public.study_consents ADD COLUMN IF NOT EXISTS paper_access_info TEXT;
