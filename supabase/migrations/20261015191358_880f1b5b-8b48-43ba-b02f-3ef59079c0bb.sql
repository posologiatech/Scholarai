DROP POLICY IF EXISTS "Authenticated users can read paper chunks" ON public.paper_chunks;

CREATE POLICY "Chunks of indexed papers readable"
  ON public.paper_chunks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.papers p
      WHERE p.external_id = paper_chunks.paper_id
    )
  );
