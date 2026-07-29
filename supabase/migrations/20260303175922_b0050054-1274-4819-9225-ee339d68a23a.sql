
-- Create datamind_db_connections table
CREATE TABLE public.datamind_db_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  db_type TEXT NOT NULL DEFAULT 'postgresql',
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 5432,
  database_name TEXT NOT NULL,
  username TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  ssl_mode TEXT NOT NULL DEFAULT 'require',
  is_active BOOLEAN NOT NULL DEFAULT true,
  schema_cache JSONB,
  last_connected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.datamind_db_connections ENABLE ROW LEVEL SECURITY;

-- Policies: users only access their own connections
CREATE POLICY "Users can view own db connections"
ON public.datamind_db_connections FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own db connections"
ON public.datamind_db_connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own db connections"
ON public.datamind_db_connections FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own db connections"
ON public.datamind_db_connections FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_datamind_db_connections_updated_at
BEFORE UPDATE ON public.datamind_db_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
