-- Review module phase 3: screening.
--  * records carry the outcome of each closed screening phase, so a blind reviewer can see which
--    records reached full text without being able to read other reviewers' votes
--  * only designated reviewers (and the owner) may vote; only adjudicators may adjudicate
--  * AI suggestions get a score; they are written by an edge function, never by the browser

ALTER TABLE public.review_records
  ADD COLUMN IF NOT EXISTS screen_status text NOT NULL DEFAULT 'pending'
    CHECK (screen_status IN ('pending', 'ta_excluded', 'full_text', 'ft_excluded', 'included')),
  ADD COLUMN IF NOT EXISTS exclusion_reason_code text;

CREATE INDEX IF NOT EXISTS idx_review_records_status ON public.review_records(review_id, screen_status);

ALTER TABLE public.review_decisions
  ADD COLUMN IF NOT EXISTS ai_score numeric CHECK (ai_score IS NULL OR (ai_score >= 0 AND ai_score <= 1));

-- A full-text exclusion must say why (PRISMA reports the reasons).
ALTER TABLE public.review_decisions
  ADD CONSTRAINT review_decisions_ft_exclude_needs_reason
  CHECK (phase <> 'full_text' OR decision <> 'exclude' OR source = 'ai' OR reason_code IS NOT NULL);

CREATE OR REPLACE FUNCTION public.is_review_reviewer(_user_id uuid, _review_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_review_owner(_user_id, _review_id) OR EXISTS (
    SELECT 1 FROM public.review_members m
    WHERE m.review_id = _review_id AND m.user_id = _user_id AND m.role IN ('reviewer', 'adjudicator')
  );
$$;

DROP POLICY IF EXISTS "Reviewers write own decisions" ON public.review_decisions;
CREATE POLICY "Reviewers write own decisions" ON public.review_decisions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND source <> 'ai'
    AND public.is_review_reviewer(auth.uid(), review_id)
    AND (source <> 'adjudication' OR public.is_review_adjudicator(auth.uid(), review_id))
  );

DROP POLICY IF EXISTS "Reviewers update own decisions" ON public.review_decisions;
CREATE POLICY "Reviewers update own decisions" ON public.review_decisions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND source <> 'ai'
    AND (source <> 'adjudication' OR public.is_review_adjudicator(auth.uid(), review_id))
  );
