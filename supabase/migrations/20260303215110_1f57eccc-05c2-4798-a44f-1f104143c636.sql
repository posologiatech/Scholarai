
-- Add columns for community gallery
ALTER TABLE public.illustrations 
ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS category text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS style text DEFAULT NULL;

-- Allow anyone to view public illustrations
CREATE POLICY "Anyone can view public illustrations"
ON public.illustrations
FOR SELECT
USING (is_public = true);

-- Allow users to update their own illustrations (for toggling is_public)
CREATE POLICY "Users can update own illustrations"
ON public.illustrations
FOR UPDATE
USING (auth.uid() = user_id);
