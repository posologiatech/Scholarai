
-- ============================================================
-- Research Hub: enums
-- ============================================================
CREATE TYPE public.research_member_role AS ENUM (
  'pi','co_pi','orientando_ic','orientando_mestrado','orientando_doutorado','posdoc','colaborador'
);

CREATE TYPE public.research_project_status AS ENUM (
  'planejamento','em_andamento','pausado','concluido','arquivado'
);

CREATE TYPE public.research_task_status AS ENUM (
  'backlog','doing','review','done'
);

CREATE TYPE public.research_task_priority AS ENUM ('low','medium','high','urgent');

CREATE TYPE public.research_publication_status AS ENUM (
  'ideia','escrevendo','submetido','em_revisao','aceito','publicado','rejeitado'
);

CREATE TYPE public.research_advisee_level AS ENUM (
  'ic','mestrado','doutorado','posdoc','tcc','especializacao'
);

CREATE TYPE public.research_milestone_status AS ENUM ('pending','done','overdue');

-- ============================================================
-- Tables
-- ============================================================
CREATE TABLE public.research_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  workspace_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  cnpq_area TEXT,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  objectives TEXT,
  status research_project_status NOT NULL DEFAULT 'planejamento',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.research_projects ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.research_project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  user_id UUID,
  invited_email TEXT,
  full_name TEXT,
  role research_member_role NOT NULL DEFAULT 'colaborador',
  accepted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id),
  UNIQUE (project_id, invited_email)
);
ALTER TABLE public.research_project_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.research_project_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  paper_db_id UUID,
  external_paper_id TEXT,
  title TEXT NOT NULL,
  authors JSONB NOT NULL DEFAULT '[]'::jsonb,
  year INTEGER,
  doi TEXT,
  notes TEXT,
  added_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.research_project_references ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.research_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES public.research_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status research_task_status NOT NULL DEFAULT 'backlog',
  priority research_task_priority NOT NULL DEFAULT 'medium',
  assignee_id UUID,
  due_date DATE,
  position INTEGER NOT NULL DEFAULT 0,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.research_tasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.research_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  meeting_link TEXT,
  agenda TEXT,
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  audio_path TEXT,
  transcript TEXT,
  ata TEXT,
  action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.research_meetings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.research_advisees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  advisor_id UUID NOT NULL,
  user_id UUID,
  full_name TEXT NOT NULL,
  email TEXT,
  level research_advisee_level NOT NULL DEFAULT 'mestrado',
  thesis_title TEXT,
  start_date DATE,
  expected_defense_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.research_advisees ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.research_advisee_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisee_id UUID NOT NULL REFERENCES public.research_advisees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  status research_milestone_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.research_advisee_milestones ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.research_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status research_publication_status NOT NULL DEFAULT 'ideia',
  target_journal TEXT,
  doi TEXT,
  url TEXT,
  submission_date DATE,
  acceptance_date DATE,
  publication_date DATE,
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.research_publications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.research_publication_authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES public.research_publications(id) ON DELETE CASCADE,
  user_id UUID,
  full_name TEXT NOT NULL,
  email TEXT,
  affiliation TEXT,
  author_order INTEGER NOT NULL DEFAULT 1,
  is_corresponding BOOLEAN NOT NULL DEFAULT false,
  credit_roles TEXT[] NOT NULL DEFAULT '{}'
);
ALTER TABLE public.research_publication_authors ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.research_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  hypothesis TEXT,
  method TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.research_ideas ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.research_idea_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL DEFAULT 'ideia',
  label TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  position_x DOUBLE PRECISION NOT NULL DEFAULT 0,
  position_y DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.research_idea_nodes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.research_idea_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES public.research_idea_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES public.research_idea_nodes(id) ON DELETE CASCADE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.research_idea_edges ENABLE ROW LEVEL SECURITY;

-- Funding (editais)
CREATE TABLE public.funding_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency TEXT NOT NULL,
  name TEXT NOT NULL,
  feed_url TEXT,
  feed_type TEXT NOT NULL DEFAULT 'rss',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.funding_sources ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.funding_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.funding_sources(id) ON DELETE SET NULL,
  agency TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  areas TEXT[] NOT NULL DEFAULT '{}',
  url TEXT,
  external_id TEXT,
  published_at DATE,
  deadline DATE,
  amount_brl NUMERIC,
  eligibility TEXT,
  confidence REAL DEFAULT 1.0,
  is_manual BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (agency, external_id)
);
ALTER TABLE public.funding_calls ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.funding_call_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  call_id UUID NOT NULL REFERENCES public.funding_calls(id) ON DELETE CASCADE,
  notify_days_before INTEGER NOT NULL DEFAULT 7,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, call_id)
);
ALTER TABLE public.funding_call_subscriptions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECURITY DEFINER helpers (no recursion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_research_project_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.research_projects WHERE id = _project_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.research_project_members
    WHERE project_id = _project_id AND user_id = _user_id AND accepted = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_research_project_manager(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.research_projects WHERE id = _project_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.research_project_members
    WHERE project_id = _project_id AND user_id = _user_id AND accepted = true AND role IN ('pi','co_pi')
  );
$$;

-- Auto-add owner as PI member
CREATE OR REPLACE FUNCTION public.auto_add_research_project_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.research_project_members (project_id, user_id, role, accepted)
  VALUES (NEW.id, NEW.owner_id, 'pi', true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_research_projects_owner
AFTER INSERT ON public.research_projects
FOR EACH ROW EXECUTE FUNCTION public.auto_add_research_project_owner();

-- updated_at triggers (reuse existing function)
CREATE TRIGGER trg_research_projects_updated BEFORE UPDATE ON public.research_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_research_tasks_updated BEFORE UPDATE ON public.research_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_research_meetings_updated BEFORE UPDATE ON public.research_meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_research_advisees_updated BEFORE UPDATE ON public.research_advisees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_research_publications_updated BEFORE UPDATE ON public.research_publications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_funding_calls_updated BEFORE UPDATE ON public.funding_calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS Policies
-- ============================================================
-- research_projects
CREATE POLICY "Members can view projects" ON public.research_projects
  FOR SELECT USING (public.is_research_project_member(auth.uid(), id));
CREATE POLICY "Users can create projects" ON public.research_projects
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Managers can update projects" ON public.research_projects
  FOR UPDATE USING (public.is_research_project_manager(auth.uid(), id));
CREATE POLICY "Owner can delete projects" ON public.research_projects
  FOR DELETE USING (auth.uid() = owner_id);

-- research_project_members
CREATE POLICY "Members can view members" ON public.research_project_members
  FOR SELECT USING (public.is_research_project_member(auth.uid(), project_id) OR user_id = auth.uid());
CREATE POLICY "Managers can insert members" ON public.research_project_members
  FOR INSERT WITH CHECK (public.is_research_project_manager(auth.uid(), project_id));
CREATE POLICY "Managers can update members" ON public.research_project_members
  FOR UPDATE USING (public.is_research_project_manager(auth.uid(), project_id) OR user_id = auth.uid());
CREATE POLICY "Managers can delete members" ON public.research_project_members
  FOR DELETE USING (public.is_research_project_manager(auth.uid(), project_id));

-- research_project_references
CREATE POLICY "Members can view refs" ON public.research_project_references
  FOR SELECT USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Members can add refs" ON public.research_project_references
  FOR INSERT WITH CHECK (public.is_research_project_member(auth.uid(), project_id) AND added_by = auth.uid());
CREATE POLICY "Members can update refs" ON public.research_project_references
  FOR UPDATE USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Members can delete refs" ON public.research_project_references
  FOR DELETE USING (public.is_research_project_member(auth.uid(), project_id));

-- research_tasks
CREATE POLICY "Members can view tasks" ON public.research_tasks
  FOR SELECT USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Members can insert tasks" ON public.research_tasks
  FOR INSERT WITH CHECK (public.is_research_project_member(auth.uid(), project_id) AND created_by = auth.uid());
CREATE POLICY "Members can update tasks" ON public.research_tasks
  FOR UPDATE USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Members can delete tasks" ON public.research_tasks
  FOR DELETE USING (public.is_research_project_member(auth.uid(), project_id));

-- research_meetings
CREATE POLICY "Members can view meetings" ON public.research_meetings
  FOR SELECT USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Members can insert meetings" ON public.research_meetings
  FOR INSERT WITH CHECK (public.is_research_project_member(auth.uid(), project_id) AND created_by = auth.uid());
CREATE POLICY "Members can update meetings" ON public.research_meetings
  FOR UPDATE USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Members can delete meetings" ON public.research_meetings
  FOR DELETE USING (public.is_research_project_member(auth.uid(), project_id));

-- research_advisees
CREATE POLICY "Members can view advisees" ON public.research_advisees
  FOR SELECT USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Managers can insert advisees" ON public.research_advisees
  FOR INSERT WITH CHECK (public.is_research_project_manager(auth.uid(), project_id));
CREATE POLICY "Managers can update advisees" ON public.research_advisees
  FOR UPDATE USING (public.is_research_project_manager(auth.uid(), project_id) OR advisor_id = auth.uid());
CREATE POLICY "Managers can delete advisees" ON public.research_advisees
  FOR DELETE USING (public.is_research_project_manager(auth.uid(), project_id));

-- research_advisee_milestones
CREATE POLICY "Members can view milestones" ON public.research_advisee_milestones
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.research_advisees a
    WHERE a.id = advisee_id AND public.is_research_project_member(auth.uid(), a.project_id)
  ));
CREATE POLICY "Members can manage milestones" ON public.research_advisee_milestones
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.research_advisees a
    WHERE a.id = advisee_id AND public.is_research_project_member(auth.uid(), a.project_id)
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.research_advisees a
    WHERE a.id = advisee_id AND public.is_research_project_member(auth.uid(), a.project_id)
  ));

-- research_publications
CREATE POLICY "Members can view pubs" ON public.research_publications
  FOR SELECT USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Members can insert pubs" ON public.research_publications
  FOR INSERT WITH CHECK (public.is_research_project_member(auth.uid(), project_id) AND created_by = auth.uid());
CREATE POLICY "Members can update pubs" ON public.research_publications
  FOR UPDATE USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Members can delete pubs" ON public.research_publications
  FOR DELETE USING (public.is_research_project_member(auth.uid(), project_id));

-- research_publication_authors
CREATE POLICY "Members can view pub authors" ON public.research_publication_authors
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.research_publications p
    WHERE p.id = publication_id AND public.is_research_project_member(auth.uid(), p.project_id)
  ));
CREATE POLICY "Members can manage pub authors" ON public.research_publication_authors
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.research_publications p
    WHERE p.id = publication_id AND public.is_research_project_member(auth.uid(), p.project_id)
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.research_publications p
    WHERE p.id = publication_id AND public.is_research_project_member(auth.uid(), p.project_id)
  ));

-- research_ideas
CREATE POLICY "Members can view ideas" ON public.research_ideas
  FOR SELECT USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Members can insert ideas" ON public.research_ideas
  FOR INSERT WITH CHECK (public.is_research_project_member(auth.uid(), project_id) AND created_by = auth.uid());
CREATE POLICY "Members can update ideas" ON public.research_ideas
  FOR UPDATE USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Members can delete ideas" ON public.research_ideas
  FOR DELETE USING (public.is_research_project_member(auth.uid(), project_id));

-- nodes / edges
CREATE POLICY "Members can manage nodes" ON public.research_idea_nodes
  FOR ALL USING (public.is_research_project_member(auth.uid(), project_id))
  WITH CHECK (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Members can manage edges" ON public.research_idea_edges
  FOR ALL USING (public.is_research_project_member(auth.uid(), project_id))
  WITH CHECK (public.is_research_project_member(auth.uid(), project_id));

-- funding_sources (admin manages, all read)
CREATE POLICY "Authenticated can view funding sources" ON public.funding_sources
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manages funding sources" ON public.funding_sources
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- funding_calls (public read for authenticated; admin or service inserts; user can insert manual)
CREATE POLICY "Authenticated can view funding calls" ON public.funding_calls
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create manual funding calls" ON public.funding_calls
  FOR INSERT TO authenticated WITH CHECK (is_manual = true AND created_by = auth.uid());
CREATE POLICY "Admin or service can insert any funding call" ON public.funding_calls
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR auth.role() = 'service_role');
CREATE POLICY "Admin or service can update funding calls" ON public.funding_calls
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'::app_role) OR auth.role() = 'service_role'
                    OR (is_manual = true AND created_by = auth.uid()));
CREATE POLICY "Admin or creator can delete funding calls" ON public.funding_calls
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'::app_role) OR (is_manual = true AND created_by = auth.uid()));

-- funding_call_subscriptions (private)
CREATE POLICY "Users manage own subscriptions" ON public.funding_call_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Seeds: funding_sources
-- ============================================================
INSERT INTO public.funding_sources (agency, name, feed_url, feed_type) VALUES
  ('CNPq', 'CNPq - Chamadas Públicas', 'https://www.gov.br/cnpq/pt-br/assuntos/chamadas-publicas/rss', 'rss'),
  ('FAPESP', 'FAPESP - Oportunidades', 'https://fapesp.br/oportunidades/rss', 'rss'),
  ('CAPES', 'CAPES - Editais', 'https://www.gov.br/capes/pt-br/assuntos/editais/rss', 'rss'),
  ('Finep', 'Finep - Chamadas', NULL, 'manual')
ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX idx_research_tasks_project_status ON public.research_tasks(project_id, status);
CREATE INDEX idx_research_meetings_project_date ON public.research_meetings(project_id, scheduled_at);
CREATE INDEX idx_research_publications_project_status ON public.research_publications(project_id, status);
CREATE INDEX idx_funding_calls_deadline ON public.funding_calls(deadline);
CREATE INDEX idx_research_advisees_advisor ON public.research_advisees(advisor_id);
