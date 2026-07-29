-- ============================================================
-- P3: mention notifications, comment threading/resolve, tasks in workspaces
-- ============================================================

-- ---------- 1. Comment threading + resolve ----------
ALTER TABLE public.research_comments
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID;

-- Preference reads for other users are blocked by RLS on research_notification_prefs
-- (a member can only see their own row), so the "should I notify this recipient"
-- decision has to happen inside a SECURITY DEFINER function, not client-side.
CREATE OR REPLACE FUNCTION public.notify_comment_event(
  _project_id UUID,
  _recipient_id UUID,
  _type TEXT,
  _title TEXT,
  _body TEXT,
  _link TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _allowed BOOLEAN;
BEGIN
  IF _recipient_id = auth.uid() THEN
    RETURN;
  END IF;
  IF NOT public.is_research_project_member(auth.uid(), _project_id) THEN
    RETURN;
  END IF;
  IF NOT public.is_research_project_member(_recipient_id, _project_id) THEN
    RETURN;
  END IF;

  SELECT CASE _type WHEN 'mention' THEN notify_mentions ELSE notify_comments END
    INTO _allowed
    FROM public.research_notification_prefs
    WHERE user_id = _recipient_id AND project_id = _project_id;

  IF _allowed IS NULL THEN
    _allowed := true; -- no pref row yet = opted-in, matches column defaults
  END IF;

  IF _allowed THEN
    INSERT INTO public.research_notifications (user_id, project_id, type, title, body, link)
    VALUES (_recipient_id, _project_id, _type, _title, _body, _link);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_comment_event(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Only a thread root can be resolved/reopened, checked server-side (not just hidden in the UI),
-- and any project member may do it (unlike editing body, which stays author-only).
CREATE OR REPLACE FUNCTION public.set_comment_resolved(
  _comment_id UUID,
  _resolved BOOLEAN
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_id UUID;
  _parent UUID;
BEGIN
  SELECT project_id, parent_id INTO _project_id, _parent
    FROM public.research_comments WHERE id = _comment_id;

  IF _project_id IS NULL THEN
    RETURN;
  END IF;
  IF _parent IS NOT NULL THEN
    RETURN;
  END IF;
  IF NOT public.is_research_project_member(auth.uid(), _project_id) THEN
    RETURN;
  END IF;

  UPDATE public.research_comments
    SET resolved_at = CASE WHEN _resolved THEN now() ELSE NULL END,
        resolved_by = CASE WHEN _resolved THEN auth.uid() ELSE NULL END
    WHERE id = _comment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_comment_resolved(UUID, BOOLEAN) TO authenticated;

-- ---------- 2. Tasks in Workspaces ----------
ALTER TABLE public.research_tasks
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE public.research_tasks
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.research_tasks
  DROP CONSTRAINT IF EXISTS research_tasks_one_parent_check;
ALTER TABLE public.research_tasks
  ADD CONSTRAINT research_tasks_one_parent_check
  CHECK ((project_id IS NOT NULL) <> (workspace_id IS NOT NULL));

CREATE INDEX IF NOT EXISTS idx_research_tasks_workspace_status ON public.research_tasks(workspace_id, status);

DROP POLICY IF EXISTS "Members can view tasks" ON public.research_tasks;
CREATE POLICY "Members can view tasks" ON public.research_tasks
  FOR SELECT
  USING (
    (project_id IS NOT NULL AND public.is_research_project_member(auth.uid(), project_id))
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(auth.uid(), workspace_id))
  );

DROP POLICY IF EXISTS "Members can insert tasks" ON public.research_tasks;
CREATE POLICY "Members can insert tasks" ON public.research_tasks
  FOR INSERT
  WITH CHECK (
    (
      (project_id IS NOT NULL AND public.is_research_project_member(auth.uid(), project_id))
      OR (workspace_id IS NOT NULL AND public.is_workspace_member(auth.uid(), workspace_id))
    )
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Members can update tasks" ON public.research_tasks;
CREATE POLICY "Members can update tasks" ON public.research_tasks
  FOR UPDATE
  USING (
    (project_id IS NOT NULL AND public.is_research_project_member(auth.uid(), project_id))
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(auth.uid(), workspace_id))
  )
  WITH CHECK (
    (project_id IS NOT NULL AND public.is_research_project_member(auth.uid(), project_id))
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(auth.uid(), workspace_id))
  );

DROP POLICY IF EXISTS "Members can delete tasks" ON public.research_tasks;
CREATE POLICY "Members can delete tasks" ON public.research_tasks
  FOR DELETE
  USING (
    (project_id IS NOT NULL AND public.is_research_project_member(auth.uid(), project_id))
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(auth.uid(), workspace_id))
  );
