CREATE POLICY "Service role manages extraction cache"
  ON public.extraction_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
