-- The partial unique index (WHERE pmcid IS NOT NULL) can't be used as an
-- ON CONFLICT (pmcid, image_url) arbiter by PostgREST's upsert, since that
-- requires either a full unique constraint or a WHERE-qualified conflict
-- target that PostgREST doesn't express. pmcid is always non-null for rows
-- we insert (figures are only extracted for candidates that already have a
-- pmcid), so a plain, non-partial unique index covers the same cases.
DROP INDEX IF EXISTS public.paper_figures_pmcid_image_url_key;
ALTER TABLE public.paper_figures ALTER COLUMN pmcid SET NOT NULL;
CREATE UNIQUE INDEX paper_figures_pmcid_image_url_key
  ON public.paper_figures (pmcid, image_url);
