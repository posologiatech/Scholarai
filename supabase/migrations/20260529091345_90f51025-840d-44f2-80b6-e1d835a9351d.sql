ALTER TABLE public.research_schedule_items ADD COLUMN IF NOT EXISTS notes text;

CREATE TABLE IF NOT EXISTS public.research_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  description text,
  category text,
  position integer DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.research_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view favorites" ON public.research_favorites FOR SELECT TO authenticated
  USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "members insert favorites" ON public.research_favorites FOR INSERT TO authenticated
  WITH CHECK (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "members update favorites" ON public.research_favorites FOR UPDATE TO authenticated
  USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "members delete favorites" ON public.research_favorites FOR DELETE TO authenticated
  USING (public.is_research_project_member(auth.uid(), project_id));

CREATE TABLE IF NOT EXISTS public.research_defense (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.research_projects(id) ON DELETE CASCADE,
  defense_type text,
  defense_date timestamptz,
  location text,
  modality text,
  meeting_link text,
  status text DEFAULT 'planned',
  title text,
  abstract text,
  notes text,
  result text,
  grade text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.research_defense ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view defense" ON public.research_defense FOR SELECT TO authenticated
  USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "members insert defense" ON public.research_defense FOR INSERT TO authenticated
  WITH CHECK (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "members update defense" ON public.research_defense FOR UPDATE TO authenticated
  USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "members delete defense" ON public.research_defense FOR DELETE TO authenticated
  USING (public.is_research_project_member(auth.uid(), project_id));

CREATE TABLE IF NOT EXISTS public.research_defense_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  institution text,
  email text,
  lattes_url text,
  notes text,
  position integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.research_defense_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members view defense members" ON public.research_defense_members FOR SELECT TO authenticated
  USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "members insert defense members" ON public.research_defense_members FOR INSERT TO authenticated
  WITH CHECK (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "members update defense members" ON public.research_defense_members FOR UPDATE TO authenticated
  USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "members delete defense members" ON public.research_defense_members FOR DELETE TO authenticated
  USING (public.is_research_project_member(auth.uid(), project_id));