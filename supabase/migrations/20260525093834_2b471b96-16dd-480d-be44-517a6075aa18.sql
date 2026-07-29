
-- ============ Schedule dependencies + progress ============
ALTER TABLE public.research_schedule_items
  ADD COLUMN IF NOT EXISTS predecessor_id UUID REFERENCES public.research_schedule_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dependency_type TEXT NOT NULL DEFAULT 'FS' CHECK (dependency_type IN ('FS','SS','FF','SF')),
  ADD COLUMN IF NOT EXISTS progress INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS assignee_id UUID,
  ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_schedule_items_predecessor ON public.research_schedule_items(predecessor_id);

-- ============ Generic project comments (with mentions) ============
CREATE TABLE IF NOT EXISTS public.research_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'project' | 'task' | 'agenda_item' | 'schedule_item' | 'meeting'
  entity_id UUID NOT NULL,
  parent_id UUID REFERENCES public.research_comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  mentions UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_comments_entity ON public.research_comments(project_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_research_comments_mentions ON public.research_comments USING GIN(mentions);

ALTER TABLE public.research_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view project comments" ON public.research_comments;
CREATE POLICY "Members can view project comments" ON public.research_comments
  FOR SELECT TO authenticated
  USING (public.is_research_project_member(auth.uid(), project_id));

DROP POLICY IF EXISTS "Members can create comments" ON public.research_comments;
CREATE POLICY "Members can create comments" ON public.research_comments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_research_project_member(auth.uid(), project_id) AND author_id = auth.uid());

DROP POLICY IF EXISTS "Authors can edit own comments" ON public.research_comments;
CREATE POLICY "Authors can edit own comments" ON public.research_comments
  FOR UPDATE TO authenticated USING (author_id = auth.uid());

DROP POLICY IF EXISTS "Authors or managers can delete comments" ON public.research_comments;
CREATE POLICY "Authors or managers can delete comments" ON public.research_comments
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_research_project_manager(auth.uid(), project_id));

DROP TRIGGER IF EXISTS update_research_comments_updated_at ON public.research_comments;
CREATE TRIGGER update_research_comments_updated_at
  BEFORE UPDATE ON public.research_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Copilot chat history (per project, in-session opt-in) ============
CREATE TABLE IF NOT EXISTS public.research_copilot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_copilot_messages_project ON public.research_copilot_messages(project_id, created_at);

ALTER TABLE public.research_copilot_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view copilot messages" ON public.research_copilot_messages;
CREATE POLICY "Members view copilot messages" ON public.research_copilot_messages
  FOR SELECT TO authenticated
  USING (public.is_research_project_member(auth.uid(), project_id));

DROP POLICY IF EXISTS "Members insert copilot messages" ON public.research_copilot_messages;
CREATE POLICY "Members insert copilot messages" ON public.research_copilot_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_research_project_member(auth.uid(), project_id) AND user_id = auth.uid());

DROP POLICY IF EXISTS "Members delete own copilot messages" ON public.research_copilot_messages;
CREATE POLICY "Members delete own copilot messages" ON public.research_copilot_messages
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_research_project_manager(auth.uid(), project_id));
