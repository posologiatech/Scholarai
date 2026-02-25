-- Create citation_classifications table
CREATE TABLE public.citation_classifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id TEXT NOT NULL,
  cited_paper_id TEXT NOT NULL,
  classification TEXT NOT NULL CHECK (classification IN ('supporting', 'contrasting', 'mentioning')),
  citation_context TEXT,
  confidence REAL DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.citation_classifications ENABLE ROW LEVEL SECURITY;

-- Anyone can read classifications (public data)
CREATE POLICY "Anyone can read citation classifications"
  ON public.citation_classifications FOR SELECT
  USING (true);

-- Anyone can insert (edge functions insert via service role)
CREATE POLICY "Anyone can insert citation classifications"
  ON public.citation_classifications FOR INSERT
  WITH CHECK (true);

-- Create indexes for fast lookups
CREATE INDEX idx_citation_class_paper_id ON public.citation_classifications(paper_id);
CREATE INDEX idx_citation_class_cited_paper_id ON public.citation_classifications(cited_paper_id);
CREATE UNIQUE INDEX idx_citation_class_unique ON public.citation_classifications(paper_id, cited_paper_id, classification);