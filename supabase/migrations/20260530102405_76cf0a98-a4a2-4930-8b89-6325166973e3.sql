CREATE TABLE public.research_examiners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  role TEXT,
  institution TEXT,
  email TEXT,
  lattes_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_examiners TO authenticated;
GRANT ALL ON public.research_examiners TO service_role;
ALTER TABLE public.research_examiners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own examiners" ON public.research_examiners FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX idx_research_examiners_owner ON public.research_examiners(owner_id);
CREATE TRIGGER update_research_examiners_updated_at BEFORE UPDATE ON public.research_examiners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
SELECT 1;