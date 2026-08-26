-- Public bucket for the logo a researcher attaches to a survey's respond page
-- (survey.settings.branding.logoUrl) — needs anonymous read since the respond
-- page itself is unauthenticated, same shape as research-content's policies.
INSERT INTO storage.buckets (id, name, public) VALUES ('survey-branding', 'survey-branding', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "survey-branding public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'survey-branding');
CREATE POLICY "survey-branding auth insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'survey-branding');
CREATE POLICY "survey-branding auth update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'survey-branding');
CREATE POLICY "survey-branding auth delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'survey-branding');
