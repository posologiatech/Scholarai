
-- 1. Create papers table (Entidade Artigo completa)
CREATE TABLE public.papers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doi TEXT UNIQUE,
  title TEXT NOT NULL,
  authors JSONB DEFAULT '[]'::jsonb,
  year INTEGER,
  journal TEXT,
  abstract TEXT,
  source TEXT,
  url TEXT,
  open_access BOOLEAN DEFAULT false,
  external_id TEXT,
  total_citations_received INTEGER NOT NULL DEFAULT 0,
  total_supporting INTEGER NOT NULL DEFAULT 0,
  total_contrasting INTEGER NOT NULL DEFAULT 0,
  total_mentioning INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast DOI lookups
CREATE INDEX idx_papers_doi ON public.papers (doi) WHERE doi IS NOT NULL;
CREATE INDEX idx_papers_external_id ON public.papers (external_id) WHERE external_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can read papers" ON public.papers FOR SELECT USING (true);

-- Service role / anon can insert (edge functions)
CREATE POLICY "Anyone can insert papers" ON public.papers FOR INSERT WITH CHECK (true);

-- Service role can update (for triggers and edge functions)
CREATE POLICY "Anyone can update papers" ON public.papers FOR UPDATE USING (true);

-- 2. Add section column to citation_classifications
ALTER TABLE public.citation_classifications ADD COLUMN section TEXT;

-- 3. Add paper_db_id FK to citation_classifications pointing to papers table
ALTER TABLE public.citation_classifications ADD COLUMN paper_db_id UUID REFERENCES public.papers(id);
ALTER TABLE public.citation_classifications ADD COLUMN cited_paper_db_id UUID REFERENCES public.papers(id);

CREATE INDEX idx_cc_paper_db_id ON public.citation_classifications (paper_db_id) WHERE paper_db_id IS NOT NULL;
CREATE INDEX idx_cc_cited_paper_db_id ON public.citation_classifications (cited_paper_db_id) WHERE cited_paper_db_id IS NOT NULL;

-- 4. Create function to update papers counters
CREATE OR REPLACE FUNCTION public.update_paper_citation_counters()
RETURNS TRIGGER AS $$
DECLARE
  target_paper_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    target_paper_id := NEW.paper_db_id;
  ELSIF TG_OP = 'DELETE' THEN
    target_paper_id := OLD.paper_db_id;
  END IF;

  IF target_paper_id IS NOT NULL THEN
    UPDATE public.papers SET
      total_citations_received = (SELECT COUNT(*) FROM public.citation_classifications WHERE paper_db_id = target_paper_id),
      total_supporting = (SELECT COUNT(*) FROM public.citation_classifications WHERE paper_db_id = target_paper_id AND classification = 'supporting'),
      total_contrasting = (SELECT COUNT(*) FROM public.citation_classifications WHERE paper_db_id = target_paper_id AND classification = 'contrasting'),
      total_mentioning = (SELECT COUNT(*) FROM public.citation_classifications WHERE paper_db_id = target_paper_id AND classification = 'mentioning'),
      updated_at = now()
    WHERE id = target_paper_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 5. Create trigger
CREATE TRIGGER trigger_update_citation_counters
  AFTER INSERT OR DELETE ON public.citation_classifications
  FOR EACH ROW EXECUTE FUNCTION public.update_paper_citation_counters();

-- 6. Create updated_at trigger for papers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_papers_updated_at
  BEFORE UPDATE ON public.papers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
