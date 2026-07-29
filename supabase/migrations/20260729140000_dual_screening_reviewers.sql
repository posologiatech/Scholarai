-- Reviewer/adjudicator assignment for dual blind screening on systematic reviews.
CREATE TABLE IF NOT EXISTS public.systematic_review_reviewers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES public.systematic_reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'reviewer' CHECK (role IN ('reviewer', 'adjudicator')),
  project_member_id uuid REFERENCES public.research_project_members(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (review_id, user_id)
);

ALTER TABLE public.systematic_review_reviewers ENABLE ROW LEVEL SECURITY;

-- Only the review owner manages the reviewer roster.
DROP POLICY IF EXISTS "Review owners manage reviewers" ON public.systematic_review_reviewers;
CREATE POLICY "Review owners manage reviewers"
ON public.systematic_review_reviewers
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.systematic_reviews sr
    WHERE sr.id = systematic_review_reviewers.review_id AND sr.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.systematic_reviews sr
    WHERE sr.id = systematic_review_reviewers.review_id AND sr.user_id = auth.uid()
  )
);

-- An assigned reviewer can see their own assignment (role/review), but not the full roster —
-- keeps who-is-assigned-what from leaking beyond what each reviewer needs to operate.
DROP POLICY IF EXISTS "Reviewers can see their own assignment" ON public.systematic_review_reviewers;
CREATE POLICY "Reviewers can see their own assignment"
ON public.systematic_review_reviewers
FOR SELECT
USING (auth.uid() = user_id);

-- Assigned reviewers/adjudicators need read access to the review itself (question, papers,
-- criteria) to be able to screen — previously only the owner could SELECT this row at all.
DROP POLICY IF EXISTS "Assigned reviewers can view the review" ON public.systematic_reviews;
CREATE POLICY "Assigned reviewers can view the review"
ON public.systematic_reviews
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.systematic_review_reviewers rr
    WHERE rr.review_id = systematic_reviews.id AND rr.user_id = auth.uid()
  )
);

-- Let a designated adjudicator see every reviewer's screening decisions for their review
-- (needed to resolve conflicts), in addition to the existing owner/self visibility.
DROP POLICY IF EXISTS "Users can view screening decisions for their reviews" ON public.screening_decisions;
CREATE POLICY "Users can view screening decisions for their reviews"
ON public.screening_decisions
FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.systematic_reviews sr
    WHERE sr.id = screening_decisions.review_id AND sr.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.systematic_review_reviewers rr
    WHERE rr.review_id = screening_decisions.review_id
      AND rr.user_id = auth.uid()
      AND rr.role = 'adjudicator'
  )
);
