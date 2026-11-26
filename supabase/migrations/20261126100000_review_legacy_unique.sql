-- A legacy systematic review can be copied into the guided-reviews module once. The app checks first;
-- this index makes a second copy impossible even from two open tabs.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_legacy_systematic_review
  ON public.reviews(legacy_systematic_review_id)
  WHERE legacy_systematic_review_id IS NOT NULL;
