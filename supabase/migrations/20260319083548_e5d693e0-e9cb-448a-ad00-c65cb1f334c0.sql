
-- Table for epidemiological alerts configuration
CREATE TABLE public.datasus_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  disease text NOT NULL,
  location text NOT NULL,
  state_codes text[] NOT NULL DEFAULT '{}',
  threshold_std_dev numeric NOT NULL DEFAULT 2.0,
  is_active boolean NOT NULL DEFAULT true,
  frequency text NOT NULL DEFAULT 'daily',
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.datasus_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own datasus alerts"
  ON public.datasus_alerts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Table for alert detection results
CREATE TABLE public.datasus_alert_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.datasus_alerts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_level text NOT NULL DEFAULT 'yellow',
  title text NOT NULL,
  description text,
  current_value numeric,
  historical_mean numeric,
  std_deviation numeric,
  z_score numeric,
  location text,
  disease text,
  period text,
  is_read boolean NOT NULL DEFAULT false,
  detected_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.datasus_alert_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own datasus alert results"
  ON public.datasus_alert_results FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
