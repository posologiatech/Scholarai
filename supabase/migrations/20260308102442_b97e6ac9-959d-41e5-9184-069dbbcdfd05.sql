
-- Subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'active',
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can manage subscriptions" ON public.subscriptions FOR ALL USING (auth.role() = 'service_role'::text);

-- Usage tracking table
CREATE TABLE public.usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feature text NOT NULL,
  period text NOT NULL,
  count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, feature, period)
);

ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" ON public.usage_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can manage usage" ON public.usage_tracking FOR ALL USING (auth.role() = 'service_role'::text);
CREATE POLICY "Users can upsert own usage" ON public.usage_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own usage" ON public.usage_tracking FOR UPDATE USING (auth.uid() = user_id);
