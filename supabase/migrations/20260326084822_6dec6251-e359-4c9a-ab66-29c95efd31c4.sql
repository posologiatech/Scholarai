CREATE TABLE public.writing_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled Document',
  content text NOT NULL DEFAULT '',
  section text DEFAULT 'introduction',
  citation_style text DEFAULT 'APA',
  selected_paper_ids jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.writing_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own writing documents"
  ON public.writing_documents FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_writing_documents_updated_at
  BEFORE UPDATE ON public.writing_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();