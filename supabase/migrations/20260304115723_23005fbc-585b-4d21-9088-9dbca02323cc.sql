-- Fix papers table: restrict write to service_role (edge functions)
DROP POLICY IF EXISTS "Anyone can insert papers" ON public.papers;
DROP POLICY IF EXISTS "Anyone can update papers" ON public.papers;

CREATE POLICY "Service can insert papers" ON public.papers
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service can update papers" ON public.papers
  FOR UPDATE USING (auth.role() = 'service_role');

-- Fix citation_classifications: restrict insert to service_role
DROP POLICY IF EXISTS "Anyone can insert citation classifications" ON public.citation_classifications;

CREATE POLICY "Service can insert citation classifications" ON public.citation_classifications
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
