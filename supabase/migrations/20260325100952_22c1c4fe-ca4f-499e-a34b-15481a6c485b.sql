-- System changelog for tracking updates, ideas, and planned features
CREATE TABLE public.system_changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'feature',
  status text NOT NULL DEFAULT 'released',
  priority text DEFAULT 'medium',
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  module text,
  version text
);

ALTER TABLE public.system_changelog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read changelog"
  ON public.system_changelog FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert changelog"
  ON public.system_changelog FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update changelog"
  ON public.system_changelog FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete changelog"
  ON public.system_changelog FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_system_changelog_updated_at
  BEFORE UPDATE ON public.system_changelog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();