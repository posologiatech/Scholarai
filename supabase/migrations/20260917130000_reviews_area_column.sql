-- The review area (health, nursing, ...) drives which sources the module recommends.
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS area text NOT NULL DEFAULT 'health'
  CHECK (area IN ('health', 'nursing', 'pharmacy', 'psychology', 'education', 'social', 'engineering', 'general'));
