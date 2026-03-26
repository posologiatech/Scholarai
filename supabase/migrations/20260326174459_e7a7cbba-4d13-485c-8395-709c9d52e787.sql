
DROP POLICY "Anyone can read active surveys" ON public.surveys;

CREATE POLICY "Anyone can read active surveys"
ON public.surveys
FOR SELECT
TO anon
USING (status = 'active');
