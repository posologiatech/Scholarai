CREATE OR REPLACE FUNCTION public.match_project_paper_chunks(
  query_embedding extensions.vector,
  _project_id uuid,
  match_count integer DEFAULT 6,
  match_threshold double precision DEFAULT 0.4
)
RETURNS TABLE(paper_id text, paper_title text, chunk_text text, source text, similarity double precision)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_research_project_member(auth.uid(), _project_id) THEN
    RAISE EXCEPTION 'Not a project member';
  END IF;

  RETURN QUERY
  SELECT pc.paper_id, pc.paper_title, pc.chunk_text, pc.source,
         1 - (pc.embedding <=> query_embedding)::float AS similarity
  FROM public.paper_chunks pc
  WHERE pc.paper_id IN (
    SELECT r.external_paper_id
    FROM public.research_project_references r
    WHERE r.project_id = _project_id AND r.external_paper_id IS NOT NULL
  )
  AND 1 - (pc.embedding <=> query_embedding)::float > match_threshold
  ORDER BY pc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_project_paper_chunks(extensions.vector, uuid, integer, double precision) TO authenticated;