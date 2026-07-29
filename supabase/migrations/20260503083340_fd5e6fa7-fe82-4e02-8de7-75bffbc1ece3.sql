
CREATE TABLE public.reference_manager_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('zotero', 'mendeley')),
  api_key TEXT NOT NULL,
  user_library_id TEXT,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT NOT NULL DEFAULT 'idle',
  sync_config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

ALTER TABLE public.reference_manager_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own connections"
  ON public.reference_manager_connections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_ref_manager_connections_updated_at
  BEFORE UPDATE ON public.reference_manager_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
