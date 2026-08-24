-- All rows cached so far point at europepmc.org's image CDN, which blocks
-- hotlinked/proxied requests outright. The extraction function now builds
-- pmc.ncbi.nlm.nih.gov URLs instead, so the old rows are dead weight that
-- would otherwise keep resurfacing as broken images from cache.
TRUNCATE TABLE public.paper_figures;
