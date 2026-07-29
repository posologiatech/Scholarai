
-- Literature alerts / monitoring tables

-- 1. Saved alert queries
CREATE TABLE public.literature_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  query text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  frequency text NOT NULL DEFAULT 'weekly', -- daily, weekly, monthly
  last_checked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.literature_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts" ON public.literature_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own alerts" ON public.literature_alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON public.literature_alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own alerts" ON public.literature_alerts FOR DELETE USING (auth.uid() = user_id);

-- 2. Alert results (new papers found)
CREATE TABLE public.alert_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.literature_alerts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  paper_title text NOT NULL,
  paper_authors jsonb DEFAULT '[]',
  paper_year integer,
  paper_doi text,
  paper_abstract text,
  paper_url text,
  paper_source text,
  is_read boolean NOT NULL DEFAULT false,
  found_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alert results" ON public.alert_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own alert results" ON public.alert_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alert results" ON public.alert_results FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own alert results" ON public.alert_results FOR DELETE USING (auth.uid() = user_id);

-- 3. Retraction alerts
CREATE TABLE public.retraction_watches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  paper_doi text NOT NULL,
  paper_title text NOT NULL,
  paper_authors jsonb DEFAULT '[]',
  status text NOT NULL DEFAULT 'active', -- active, retracted, concern
  last_checked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.retraction_watches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own retraction watches" ON public.retraction_watches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own retraction watches" ON public.retraction_watches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own retraction watches" ON public.retraction_watches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own retraction watches" ON public.retraction_watches FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER update_literature_alerts_updated_at BEFORE UPDATE ON public.literature_alerts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
