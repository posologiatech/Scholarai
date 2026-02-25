-- Create illustrations table
CREATE TABLE public.illustrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.illustrations ENABLE ROW LEVEL SECURITY;

-- Users can view their own illustrations
CREATE POLICY "Users can view own illustrations"
  ON public.illustrations FOR SELECT
  USING (auth.uid() = user_id);

-- Users can delete their own illustrations
CREATE POLICY "Users can delete own illustrations"
  ON public.illustrations FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can insert (from edge function)
CREATE POLICY "Service can insert illustrations"
  ON public.illustrations FOR INSERT
  WITH CHECK (true);

-- Create public storage bucket for illustrations
INSERT INTO storage.buckets (id, name, public)
VALUES ('illustrations', 'illustrations', true);

-- Anyone can view illustration images (public bucket)
CREATE POLICY "Illustration images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'illustrations');

-- Allow inserts to illustrations bucket (from edge function via service role)
CREATE POLICY "Service can upload illustrations"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'illustrations');

-- Allow deletes for own illustrations
CREATE POLICY "Users can delete own illustration files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'illustrations' AND auth.uid()::text = (storage.foldername(name))[1]);