
-- Pillar 7: Collaboration

-- Notifications
CREATE TABLE public.research_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.research_projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  digest_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_research_notifications_user ON public.research_notifications(user_id, read_at, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_notifications TO authenticated;
GRANT ALL ON public.research_notifications TO service_role;
ALTER TABLE public.research_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own notifications" ON public.research_notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users update own notifications" ON public.research_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "members can insert notifications" ON public.research_notifications FOR INSERT TO authenticated WITH CHECK (project_id IS NULL OR public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "users delete own notifications" ON public.research_notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Notification preferences (per user per project)
CREATE TABLE public.research_notification_prefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  digest_frequency TEXT NOT NULL DEFAULT 'daily',
  notify_mentions BOOLEAN NOT NULL DEFAULT true,
  notify_tasks BOOLEAN NOT NULL DEFAULT true,
  notify_meetings BOOLEAN NOT NULL DEFAULT true,
  notify_risks BOOLEAN NOT NULL DEFAULT true,
  notify_comments BOOLEAN NOT NULL DEFAULT true,
  email_digest BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_notification_prefs TO authenticated;
GRANT ALL ON public.research_notification_prefs TO service_role;
ALTER TABLE public.research_notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage own prefs" ON public.research_notification_prefs FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_research_project_member(auth.uid(), project_id))
  WITH CHECK (user_id = auth.uid() AND public.is_research_project_member(auth.uid(), project_id));

-- Overview versioning
CREATE TABLE public.research_overview_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  author_id UUID,
  content TEXT NOT NULL DEFAULT '',
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_overview_versions_project ON public.research_overview_versions(project_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.research_overview_versions TO authenticated;
GRANT ALL ON public.research_overview_versions TO service_role;
ALTER TABLE public.research_overview_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read versions" ON public.research_overview_versions FOR SELECT TO authenticated USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "members insert versions" ON public.research_overview_versions FOR INSERT TO authenticated WITH CHECK (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "managers delete versions" ON public.research_overview_versions FOR DELETE TO authenticated USING (public.is_research_project_manager(auth.uid(), project_id));

-- Project integrations (Google Calendar/Drive, Zotero, Mendeley, GitHub, Overleaf)
CREATE TABLE public.research_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  label TEXT,
  external_id TEXT,
  external_url TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_research_integrations_project ON public.research_integrations(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_integrations TO authenticated;
GRANT ALL ON public.research_integrations TO service_role;
ALTER TABLE public.research_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read integrations" ON public.research_integrations FOR SELECT TO authenticated USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "managers insert integrations" ON public.research_integrations FOR INSERT TO authenticated WITH CHECK (public.is_research_project_manager(auth.uid(), project_id));
CREATE POLICY "managers update integrations" ON public.research_integrations FOR UPDATE TO authenticated USING (public.is_research_project_manager(auth.uid(), project_id));
CREATE POLICY "managers delete integrations" ON public.research_integrations FOR DELETE TO authenticated USING (public.is_research_project_manager(auth.uid(), project_id));

CREATE TRIGGER trg_research_notification_prefs_updated BEFORE UPDATE ON public.research_notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_research_integrations_updated BEFORE UPDATE ON public.research_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
