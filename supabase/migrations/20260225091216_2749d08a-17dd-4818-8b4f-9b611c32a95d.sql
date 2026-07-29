
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Create paper_chunks table for RAG embeddings
CREATE TABLE public.paper_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id TEXT NOT NULL,
  paper_title TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding extensions.vector(768),
  source TEXT DEFAULT 'abstract',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for paper_chunks
CREATE INDEX paper_chunks_paper_id_idx ON public.paper_chunks(paper_id);
CREATE INDEX paper_chunks_embedding_idx ON public.paper_chunks
  USING ivfflat (embedding extensions.vector_cosine_ops)
  WITH (lists = 100);

-- Create extraction_cache table
CREATE TABLE public.extraction_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id TEXT NOT NULL,
  column_name TEXT NOT NULL,
  column_prompt TEXT,
  extracted_value TEXT NOT NULL,
  citation_context TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(paper_id, column_name)
);

CREATE INDEX extraction_cache_paper_id_idx ON public.extraction_cache(paper_id);

-- Enable RLS on both tables
ALTER TABLE public.paper_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_cache ENABLE ROW LEVEL SECURITY;

-- paper_chunks: allow public read/insert (shared cache across users)
CREATE POLICY "Anyone can read paper chunks" ON public.paper_chunks
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert paper chunks" ON public.paper_chunks
  FOR INSERT WITH CHECK (true);

-- extraction_cache: allow public read/insert (shared cache across users)
CREATE POLICY "Anyone can read extraction cache" ON public.extraction_cache
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert extraction cache" ON public.extraction_cache
  FOR INSERT WITH CHECK (true);

-- Create a match function for semantic search
CREATE OR REPLACE FUNCTION public.match_paper_chunks(
  query_embedding extensions.vector(768),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5,
  filter_paper_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  paper_id TEXT,
  paper_title TEXT,
  chunk_index INTEGER,
  chunk_text TEXT,
  source TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.id,
    pc.paper_id,
    pc.paper_title,
    pc.chunk_index,
    pc.chunk_text,
    pc.source,
    1 - (pc.embedding <=> query_embedding)::FLOAT AS similarity
  FROM public.paper_chunks pc
  WHERE
    (filter_paper_id IS NULL OR pc.paper_id = filter_paper_id)
    AND 1 - (pc.embedding <=> query_embedding)::FLOAT > match_threshold
  ORDER BY pc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
