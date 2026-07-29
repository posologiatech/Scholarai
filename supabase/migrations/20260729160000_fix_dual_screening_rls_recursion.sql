-- Fix: the RLS policies added for dual blind screening created a circular dependency —
-- systematic_reviews' SELECT policy queries systematic_review_reviewers, whose own SELECT
-- (via the owner "FOR ALL" policy) queries systematic_reviews back, causing Postgres to
-- report "infinite recursion detected in policy" on every read of either table (and, by
-- extension, of screening_decisions too). Break the cycle with SECURITY DEFINER helper
-- functions, the same pattern already used elsewhere in this schema
-- (is_research_project_member / is_research_project_manager) — a SECURITY DEFINER function
-- reads the table as its owner, bypassing RLS instead of re-triggering it.

CREATE OR REPLACE FUNCTION public.is_systematic_review_owner(_review_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.systematic_reviews
    WHERE id = _review_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_systematic_review_reviewer(_review_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.systematic_review_reviewers
    WHERE review_id = _review_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_systematic_review_adjudicator(_review_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.systematic_review_reviewers
    WHERE review_id = _review_id AND user_id = _user_id AND role = 'adjudicator'
  );
$$;

-- Re-create the three recursive policies using the helper functions instead of inline
-- cross-table EXISTS subqueries.

DROP POLICY IF EXISTS "Review owners manage reviewers" ON public.systematic_review_reviewers;
CREATE POLICY "Review owners manage reviewers"
ON public.systematic_review_reviewers
FOR ALL
USING (public.is_systematic_review_owner(review_id, auth.uid()))
WITH CHECK (public.is_systematic_review_owner(review_id, auth.uid()));

DROP POLICY IF EXISTS "Assigned reviewers can view the review" ON public.systematic_reviews;
CREATE POLICY "Assigned reviewers can view the review"
ON public.systematic_reviews
FOR SELECT
USING (public.is_systematic_review_reviewer(id, auth.uid()));

DROP POLICY IF EXISTS "Users can view screening decisions for their reviews" ON public.screening_decisions;
CREATE POLICY "Users can view screening decisions for their reviews"
ON public.screening_decisions
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_systematic_review_owner(review_id, auth.uid())
  OR public.is_systematic_review_adjudicator(review_id, auth.uid())
);
