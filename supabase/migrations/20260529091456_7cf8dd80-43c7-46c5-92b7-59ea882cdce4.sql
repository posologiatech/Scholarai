INSERT INTO storage.buckets (id, name, public) VALUES ('research-content', 'research-content', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "research-content public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'research-content');
CREATE POLICY "research-content auth insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'research-content');
CREATE POLICY "research-content auth update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'research-content');
CREATE POLICY "research-content auth delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'research-content');