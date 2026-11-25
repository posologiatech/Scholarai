-- Creating a review failed with "new row violates row-level security policy".
-- INSERT ... RETURNING also checks the SELECT policy, and that policy only called
-- can_access_review(), a function that looks the review up in the table. Inside the same
-- statement it cannot see the row being inserted, so the owner was refused their own review.
-- Matching the owner directly on the row needs no lookup.
DROP POLICY IF EXISTS "Review participants can view" ON public.reviews;
CREATE POLICY "Review participants can view" ON public.reviews
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.can_access_review(auth.uid(), id));
