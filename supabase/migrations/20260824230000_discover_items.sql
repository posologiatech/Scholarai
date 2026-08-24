-- "Discover" feed: featured papers with an AI-generated summary and cover
-- image, refreshed periodically by refresh-discover-feed (see the
-- companion cron migration). Public read-only content, no per-user data.
CREATE TABLE public.discover_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paper_id UUID REFERENCES public.papers(id),
  doi TEXT UNIQUE,
  title TEXT NOT NULL,
  source_label TEXT NOT NULL,
  summary TEXT NOT NULL,
  image_url TEXT NOT NULL,
  paper_url TEXT,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_discover_items_published_at ON public.discover_items (published_at DESC);

ALTER TABLE public.discover_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read discover items" ON public.discover_items FOR SELECT USING (true);
-- No INSERT/UPDATE/DELETE policy: only the service-role key (used exclusively by
-- refresh-discover-feed) writes here — service_role already bypasses RLS.

INSERT INTO storage.buckets (id, name, public) VALUES ('discover-covers', 'discover-covers', true);

CREATE POLICY "Discover covers are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'discover-covers');
-- No insert policy for the bucket either — only the service role writes to it.
