CREATE TABLE public.orcid_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  orcid_id TEXT NOT NULL,
  name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  scope TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orcid_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own orcid connection"
  ON public.orcid_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own orcid connection"
  ON public.orcid_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own orcid connection"
  ON public.orcid_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own orcid connection"
  ON public.orcid_connections FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_orcid_connections_updated_at
  BEFORE UPDATE ON public.orcid_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();