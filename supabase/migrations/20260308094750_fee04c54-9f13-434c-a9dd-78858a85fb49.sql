
CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  event_name text NOT NULL,
  page_path text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Admins can read all events
CREATE POLICY "Admins can read analytics_events"
  ON public.analytics_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Anyone can insert (anonymous tracking allowed)
CREATE POLICY "Anyone can insert analytics_events"
  ON public.analytics_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Create index for common queries
CREATE INDEX idx_analytics_events_created_at ON public.analytics_events (created_at DESC);
CREATE INDEX idx_analytics_events_event_name ON public.analytics_events (event_name);
