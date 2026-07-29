
-- Create datamind_dashboards table
CREATE TABLE public.datamind_dashboards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Novo Dashboard',
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  share_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create datamind_dashboard_items table
CREATE TABLE public.datamind_dashboard_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dashboard_id UUID NOT NULL REFERENCES public.datamind_dashboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'chart',
  title TEXT NOT NULL DEFAULT 'Item',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  position JSONB NOT NULL DEFAULT '{"x": 0, "y": 0, "w": 6, "h": 4}'::jsonb,
  source_message_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.datamind_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datamind_dashboard_items ENABLE ROW LEVEL SECURITY;

-- Dashboard policies: owner CRUD
CREATE POLICY "Users can view own dashboards"
ON public.datamind_dashboards FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Public dashboards are viewable by everyone"
ON public.datamind_dashboards FOR SELECT
USING (is_public = true);

CREATE POLICY "Users can create own dashboards"
ON public.datamind_dashboards FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dashboards"
ON public.datamind_dashboards FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own dashboards"
ON public.datamind_dashboards FOR DELETE
USING (auth.uid() = user_id);

-- Dashboard items policies
CREATE POLICY "Users can view own dashboard items"
ON public.datamind_dashboard_items FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Public dashboard items are viewable"
ON public.datamind_dashboard_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.datamind_dashboards d
  WHERE d.id = dashboard_id AND d.is_public = true
));

CREATE POLICY "Users can insert own dashboard items"
ON public.datamind_dashboard_items FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dashboard items"
ON public.datamind_dashboard_items FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own dashboard items"
ON public.datamind_dashboard_items FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_datamind_dashboards_updated_at
BEFORE UPDATE ON public.datamind_dashboards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
