-- Review module foundation (phase 0): generic, normalized storage for guided reviews of any type
-- (systematic, scoping, integrative, ...). Unlike systematic_reviews, records live one per row instead
-- of in a single JSONB blob, so a real review (thousands of records) stays queryable and lockable.
-- The legacy systematic_reviews table is untouched; legacy_systematic_review_id lets a later phase migrate it.

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  review_type text NOT NULL CHECK (review_type IN (
    'systematic', 'scoping', 'integrative', 'narrative', 'rapid', 'umbrella', 'qualitative', 'realist'
  )),
  is_living boolean NOT NULL DEFAULT false,
  title text NOT NULL DEFAULT '',
  question text NOT NULL DEFAULT '',
  locale text NOT NULL DEFAULT 'pt' CHECK (locale IN ('pt', 'en')),
  -- Version of the in-code type definition the review was started under, so later definition
  -- changes never silently rewrite the process of a review already under way.
  definition_version text NOT NULL,
  framework jsonb NOT NULL DEFAULT '{}'::jsonb,   -- PICO / PCC / SPIDER fields
  eligibility jsonb NOT NULL DEFAULT '[]'::jsonb, -- inclusion/exclusion criteria
  registry jsonb NOT NULL DEFAULT '{}'::jsonb,    -- { name, id, url }
  protocol_document text,
  protocol_locked_at timestamptz,
  protocol_locked_by uuid,
  current_stage text NOT NULL DEFAULT 'scope',
  stage_state jsonb NOT NULL DEFAULT '{}'::jsonb, -- per-stage { status, completed_at, notes }
  ai_disclosure jsonb NOT NULL DEFAULT '[]'::jsonb,
  research_project_id uuid REFERENCES public.research_projects(id) ON DELETE SET NULL,
  legacy_systematic_review_id uuid REFERENCES public.systematic_reviews(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_owner ON public.reviews(owner_id);
CREATE INDEX IF NOT EXISTS idx_reviews_project ON public.reviews(research_project_id);

CREATE TABLE IF NOT EXISTS public.review_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'reviewer' CHECK (role IN ('reviewer', 'adjudicator', 'collaborator')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, user_id)
);

-- Access check lives in SECURITY DEFINER functions so policies on child tables never re-enter
-- the RLS of reviews/review_members (that recursion already bit dual screening once).
CREATE OR REPLACE FUNCTION public.can_access_review(_user_id uuid, _review_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reviews r
    WHERE r.id = _review_id
      AND (
        r.owner_id = _user_id
        OR (r.research_project_id IS NOT NULL AND public.is_research_project_member(_user_id, r.research_project_id))
      )
  ) OR EXISTS (
    SELECT 1 FROM public.review_members m WHERE m.review_id = _review_id AND m.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_review_owner(_user_id uuid, _review_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.reviews r WHERE r.id = _review_id AND r.owner_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_review_adjudicator(_user_id uuid, _review_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_review_owner(_user_id, _review_id) OR EXISTS (
    SELECT 1 FROM public.review_members m
    WHERE m.review_id = _review_id AND m.user_id = _user_id AND m.role = 'adjudicator'
  );
$$;

-- Search log (PRISMA-S): one row per search run or import, per source.
CREATE TABLE IF NOT EXISTS public.review_searches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  source text NOT NULL,                 -- see src/lib/review/databases.ts
  method text NOT NULL CHECK (method IN ('api', 'import', 'manual')),
  interface text,                       -- e.g. "Ovid", "Scopus web", "PubMed API"
  query text NOT NULL DEFAULT '',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_at timestamptz NOT NULL DEFAULT now(),
  results_count integer,                -- hits reported by the source
  imported_count integer NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_searches_review ON public.review_searches(review_id);

CREATE TABLE IF NOT EXISTS public.review_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  search_id uuid REFERENCES public.review_searches(id) ON DELETE SET NULL,
  source text NOT NULL,
  external_id text,
  doi text,                             -- normalized lowercase, no URL prefix
  title text NOT NULL,
  authors jsonb NOT NULL DEFAULT '[]'::jsonb,
  year integer,
  abstract text,
  journal text,
  url text,
  study_design text,
  dedupe_key text,                      -- normalized title|year|first-author, for fuzzy grouping
  duplicate_of uuid REFERENCES public.review_records(id) ON DELETE SET NULL,
  full_text_status text NOT NULL DEFAULT 'unknown' CHECK (full_text_status IN ('unknown', 'available', 'pending', 'unavailable')),
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_records_review ON public.review_records(review_id);
CREATE INDEX IF NOT EXISTS idx_review_records_doi ON public.review_records(review_id, doi) WHERE doi IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_review_records_dedupe ON public.review_records(review_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_review_records_search ON public.review_records(search_id);

CREATE TABLE IF NOT EXISTS public.review_decisions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES public.review_records(id) ON DELETE CASCADE,
  phase text NOT NULL CHECK (phase IN ('title_abstract', 'full_text')),
  decision text NOT NULL CHECK (decision IN ('include', 'exclude', 'maybe')),
  reason_code text,
  reason text,
  -- AI decisions are stored apart from human ones and never count as a reviewer vote.
  source text NOT NULL DEFAULT 'human' CHECK (source IN ('human', 'ai', 'adjudication')),
  user_id uuid,
  ai_model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((source = 'ai' AND user_id IS NULL) OR (source <> 'ai' AND user_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_decisions_human
  ON public.review_decisions(record_id, phase, user_id, source) WHERE source <> 'ai';
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_decisions_ai
  ON public.review_decisions(record_id, phase) WHERE source = 'ai';
CREATE INDEX IF NOT EXISTS idx_review_decisions_review ON public.review_decisions(review_id, phase);

CREATE TABLE IF NOT EXISTS public.review_extractions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES public.review_records(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,       -- field key -> value
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,   -- field key -> { quote, page } source in the text
  ai_proposed jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'verified')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (record_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_review_extractions_review ON public.review_extractions(review_id);

CREATE TABLE IF NOT EXISTS public.review_appraisals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  record_id uuid NOT NULL REFERENCES public.review_records(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tool text NOT NULL,                            -- rob2, robins-i, nos, mmat, amstar2, casp, sanra...
  domains jsonb NOT NULL DEFAULT '{}'::jsonb,    -- domain key -> { judgement, support }
  overall text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (record_id, user_id, tool)
);
CREATE INDEX IF NOT EXISTS idx_review_appraisals_review ON public.review_appraisals(review_id);

CREATE TABLE IF NOT EXISTS public.review_artifacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  kind text NOT NULL,                            -- prisma_flow, rob_traffic_light, forest, characteristics_table...
  title text NOT NULL DEFAULT '',
  spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  stale boolean NOT NULL DEFAULT false,          -- set when upstream decisions change
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, kind)
);

CREATE TABLE IF NOT EXISTS public.review_checklist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  guideline text NOT NULL,                       -- prisma2020, prisma-scr, ...
  item_key text NOT NULL,
  status text NOT NULL DEFAULT 'missing' CHECK (status IN ('met', 'partial', 'missing', 'not_applicable')),
  location text,                                 -- section or anchor in the manuscript
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, guideline, item_key)
);

CREATE TABLE IF NOT EXISTS public.review_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id uuid,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_events_review ON public.review_events(review_id, created_at);

-- ───────────── RLS ─────────────
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_appraisals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.reviews, public.review_members, public.review_searches, public.review_records,
  public.review_decisions, public.review_extractions, public.review_appraisals,
  public.review_artifacts, public.review_checklist TO authenticated;
GRANT SELECT, INSERT ON public.review_events TO authenticated;
GRANT ALL ON
  public.reviews, public.review_members, public.review_searches, public.review_records,
  public.review_decisions, public.review_extractions, public.review_appraisals,
  public.review_artifacts, public.review_checklist, public.review_events TO service_role;

-- reviews
CREATE POLICY "Review participants can view" ON public.reviews
  FOR SELECT TO authenticated USING (public.can_access_review(auth.uid(), id));
CREATE POLICY "Users create own reviews" ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner updates review" ON public.reviews
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner deletes review" ON public.reviews
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- review_members: owner manages the roster; each member sees only their own row
CREATE POLICY "Owner manages members" ON public.review_members
  FOR ALL TO authenticated
  USING (public.is_review_owner(auth.uid(), review_id))
  WITH CHECK (public.is_review_owner(auth.uid(), review_id));
CREATE POLICY "Members see own membership" ON public.review_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- shared working data: any participant reads and writes
CREATE POLICY "Participants manage searches" ON public.review_searches
  FOR ALL TO authenticated
  USING (public.can_access_review(auth.uid(), review_id))
  WITH CHECK (public.can_access_review(auth.uid(), review_id));
CREATE POLICY "Participants manage records" ON public.review_records
  FOR ALL TO authenticated
  USING (public.can_access_review(auth.uid(), review_id))
  WITH CHECK (public.can_access_review(auth.uid(), review_id));
CREATE POLICY "Participants manage artifacts" ON public.review_artifacts
  FOR ALL TO authenticated
  USING (public.can_access_review(auth.uid(), review_id))
  WITH CHECK (public.can_access_review(auth.uid(), review_id));
CREATE POLICY "Participants manage checklist" ON public.review_checklist
  FOR ALL TO authenticated
  USING (public.can_access_review(auth.uid(), review_id))
  WITH CHECK (public.can_access_review(auth.uid(), review_id));

-- screening is blind: a reviewer sees only their own votes (and AI proposals);
-- the owner and adjudicators see everyone's so conflicts can be resolved
CREATE POLICY "Blind screening read" ON public.review_decisions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (source = 'ai' AND public.can_access_review(auth.uid(), review_id))
    OR public.is_review_adjudicator(auth.uid(), review_id)
  );
CREATE POLICY "Reviewers write own decisions" ON public.review_decisions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND source <> 'ai' AND public.can_access_review(auth.uid(), review_id));
CREATE POLICY "Reviewers update own decisions" ON public.review_decisions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND source <> 'ai');
CREATE POLICY "Reviewers delete own decisions" ON public.review_decisions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- extraction / appraisal: independent per reviewer; owner and adjudicators see all
CREATE POLICY "Extraction read" ON public.review_extractions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_review_adjudicator(auth.uid(), review_id));
CREATE POLICY "Extraction write own" ON public.review_extractions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.can_access_review(auth.uid(), review_id));
CREATE POLICY "Appraisal read" ON public.review_appraisals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_review_adjudicator(auth.uid(), review_id));
CREATE POLICY "Appraisal write own" ON public.review_appraisals
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.can_access_review(auth.uid(), review_id));

-- audit log: append-only for users
CREATE POLICY "Participants read events" ON public.review_events
  FOR SELECT TO authenticated USING (public.can_access_review(auth.uid(), review_id));
CREATE POLICY "Participants append events" ON public.review_events
  FOR INSERT TO authenticated
  WITH CHECK (public.can_access_review(auth.uid(), review_id) AND (user_id IS NULL OR user_id = auth.uid()));

-- Once the protocol is locked, the question, framework and eligibility criteria cannot change
-- (a deviation must be recorded as an event, not by editing the registered protocol).
CREATE OR REPLACE FUNCTION public.reviews_protect_locked_protocol()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.protocol_locked_at IS NOT NULL AND (
       NEW.question IS DISTINCT FROM OLD.question
    OR NEW.framework IS DISTINCT FROM OLD.framework
    OR NEW.eligibility IS DISTINCT FROM OLD.eligibility
    OR NEW.review_type IS DISTINCT FROM OLD.review_type
    OR NEW.protocol_locked_at IS DISTINCT FROM OLD.protocol_locked_at
    OR NEW.protocol_document IS DISTINCT FROM OLD.protocol_document
  ) THEN
    RAISE EXCEPTION 'Protocol is locked; record a deviation instead of editing it.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reviews_protect_locked_protocol
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_protect_locked_protocol();

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
