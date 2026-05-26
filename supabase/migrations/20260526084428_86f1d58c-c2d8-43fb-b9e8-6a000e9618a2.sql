
ALTER TABLE public.research_projects
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_slug text UNIQUE;

-- Compliance checklist
CREATE TABLE IF NOT EXISTS public.research_compliance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  due_date date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compliance_project ON public.research_compliance_items(project_id);
ALTER TABLE public.research_compliance_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view compliance" ON public.research_compliance_items
  FOR SELECT USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Members manage compliance" ON public.research_compliance_items
  FOR ALL USING (public.is_research_project_member(auth.uid(), project_id))
  WITH CHECK (public.is_research_project_member(auth.uid(), project_id));

CREATE TRIGGER trg_compliance_updated BEFORE UPDATE ON public.research_compliance_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Risk alerts
CREATE TABLE IF NOT EXISTS public.research_risk_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  message text,
  related_entity_type text,
  related_entity_id uuid,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_risk_project ON public.research_risk_alerts(project_id);
ALTER TABLE public.research_risk_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view risks" ON public.research_risk_alerts
  FOR SELECT USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Members manage risks" ON public.research_risk_alerts
  FOR ALL USING (public.is_research_project_member(auth.uid(), project_id))
  WITH CHECK (public.is_research_project_member(auth.uid(), project_id));

-- Public read access for public projects (limited use, anyone)
CREATE POLICY "Public can read public projects" ON public.research_projects
  FOR SELECT USING (is_public = true);

CREATE POLICY "Public can read public project publications" ON public.research_publications
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.research_projects p WHERE p.id = project_id AND p.is_public = true));

CREATE POLICY "Public can read public project schedule" ON public.research_schedule_items
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.research_projects p WHERE p.id = project_id AND p.is_public = true));
