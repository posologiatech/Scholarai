-- Figures/images extracted from Europe PMC full-text XML, cached per paper
CREATE TABLE public.paper_figures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id UUID REFERENCES public.papers(id) ON DELETE SET NULL,
  doi TEXT,
  pmcid TEXT,
  source_paper_title TEXT NOT NULL,
  journal TEXT,
  year INTEGER,
  paper_url TEXT,
  image_url TEXT NOT NULL,
  caption TEXT,
  figure_label TEXT,
  source TEXT NOT NULL DEFAULT 'europe_pmc',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Dedupe figures per article on repeat searches
CREATE UNIQUE INDEX paper_figures_pmcid_image_url_key
  ON public.paper_figures (pmcid, image_url) WHERE pmcid IS NOT NULL;

CREATE INDEX idx_paper_figures_paper_id ON public.paper_figures (paper_id) WHERE paper_id IS NOT NULL;
CREATE INDEX idx_paper_figures_doi ON public.paper_figures (doi) WHERE doi IS NOT NULL;
CREATE INDEX idx_paper_figures_pmcid ON public.paper_figures (pmcid) WHERE pmcid IS NOT NULL;

ALTER TABLE public.paper_figures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read paper_figures" ON public.paper_figures FOR SELECT USING (true);
CREATE POLICY "Anyone can insert paper_figures" ON public.paper_figures FOR INSERT WITH CHECK (true);
