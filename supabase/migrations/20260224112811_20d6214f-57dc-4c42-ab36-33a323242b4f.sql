-- Create storage bucket for PDF uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('papers', 'papers', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload PDFs to their own folder
CREATE POLICY "Users can upload their own papers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'papers' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own papers
CREATE POLICY "Users can read their own papers"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'papers' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own papers
CREATE POLICY "Users can delete their own papers"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'papers' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create a table to track uploaded papers and their extracted data
CREATE TABLE public.uploaded_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  title TEXT,
  extracted_text TEXT,
  extraction_data JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'ready', 'error')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.uploaded_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own uploaded papers"
ON public.uploaded_papers FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own uploaded papers"
ON public.uploaded_papers FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own uploaded papers"
ON public.uploaded_papers FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own uploaded papers"
ON public.uploaded_papers FOR DELETE
TO authenticated
USING (user_id = auth.uid());