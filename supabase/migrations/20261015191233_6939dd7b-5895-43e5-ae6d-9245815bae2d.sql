-- extraction_cache: internal cache; only service-role (edge functions) should access it
DROP POLICY IF EXISTS "Anyone can read extraction cache" ON public.extraction_cache;

-- paper_chunks: restrict reads to authenticated users; edge functions use service role which bypasses RLS
DROP POLICY IF EXISTS "Anyone can read paper chunks" ON public.paper_chunks;
CREATE POLICY "Authenticated users can read paper chunks"
  ON public.paper_chunks
  FOR SELECT
  TO authenticated
  USING (true);

-- user_approvals: inserts happen exclusively via server-side (service role) flows
DROP POLICY IF EXISTS "Service can insert approvals" ON public.user_approvals;

GRANT SELECT ON public.paper_chunks TO authenticated;
GRANT ALL ON public.paper_chunks, public.extraction_cache TO service_role;
