
-- Create datamind_pipelines table
CREATE TABLE public.datamind_pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Novo Pipeline',
  description TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_public BOOLEAN NOT NULL DEFAULT false,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create datamind_pipeline_steps table
CREATE TABLE public.datamind_pipeline_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES public.datamind_pipelines(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL DEFAULT 0,
  prompt TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL DEFAULT '',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.datamind_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datamind_pipeline_steps ENABLE ROW LEVEL SECURITY;

-- Pipeline policies
CREATE POLICY "Users can view own pipelines"
ON public.datamind_pipelines FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Public pipelines are viewable"
ON public.datamind_pipelines FOR SELECT
USING (is_public = true);

CREATE POLICY "Users can create own pipelines"
ON public.datamind_pipelines FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pipelines"
ON public.datamind_pipelines FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pipelines"
ON public.datamind_pipelines FOR DELETE
USING (auth.uid() = user_id);

-- Pipeline steps policies
CREATE POLICY "Users can view own pipeline steps"
ON public.datamind_pipeline_steps FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.datamind_pipelines p
  WHERE p.id = pipeline_id AND p.user_id = auth.uid()
));

CREATE POLICY "Public pipeline steps are viewable"
ON public.datamind_pipeline_steps FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.datamind_pipelines p
  WHERE p.id = pipeline_id AND p.is_public = true
));

CREATE POLICY "Users can insert own pipeline steps"
ON public.datamind_pipeline_steps FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.datamind_pipelines p
  WHERE p.id = pipeline_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can update own pipeline steps"
ON public.datamind_pipeline_steps FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.datamind_pipelines p
  WHERE p.id = pipeline_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can delete own pipeline steps"
ON public.datamind_pipeline_steps FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.datamind_pipelines p
  WHERE p.id = pipeline_id AND p.user_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_datamind_pipelines_updated_at
BEFORE UPDATE ON public.datamind_pipelines
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
