
-- ===== 1. Project body =====
ALTER TABLE public.research_projects
  ADD COLUMN IF NOT EXISTS full_content text;

-- ===== 2. Tasks: source meeting link =====
ALTER TABLE public.research_tasks
  ADD COLUMN IF NOT EXISTS source_meeting_id uuid REFERENCES public.research_meetings(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_research_tasks_source_meeting ON public.research_tasks(source_meeting_id);

-- ===== 3. Meetings: notes column =====
ALTER TABLE public.research_meetings
  ADD COLUMN IF NOT EXISTS notes text;

-- ===== 4. Agenda items =====
CREATE TABLE IF NOT EXISTS public.research_meeting_agenda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.research_meetings(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  position integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  source_task_id uuid REFERENCES public.research_tasks(id) ON DELETE SET NULL,
  source_schedule_item_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agenda_items_meeting ON public.research_meeting_agenda_items(meeting_id);

ALTER TABLE public.research_meeting_agenda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view agenda items"
  ON public.research_meeting_agenda_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.research_meetings m WHERE m.id = meeting_id AND public.is_research_project_member(auth.uid(), m.project_id)));
CREATE POLICY "Members can insert agenda items"
  ON public.research_meeting_agenda_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.research_meetings m WHERE m.id = meeting_id AND public.is_research_project_member(auth.uid(), m.project_id)));
CREATE POLICY "Members can update agenda items"
  ON public.research_meeting_agenda_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.research_meetings m WHERE m.id = meeting_id AND public.is_research_project_member(auth.uid(), m.project_id)));
CREATE POLICY "Members can delete agenda items"
  ON public.research_meeting_agenda_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.research_meetings m WHERE m.id = meeting_id AND public.is_research_project_member(auth.uid(), m.project_id)));

CREATE TRIGGER trg_agenda_items_updated
  BEFORE UPDATE ON public.research_meeting_agenda_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 5. Meeting attachments =====
CREATE TABLE IF NOT EXISTS public.research_meeting_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.research_meetings(id) ON DELETE CASCADE,
  agenda_item_id uuid REFERENCES public.research_meeting_agenda_items(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('file','youtube','link')),
  file_path text,
  file_name text,
  mime_type text,
  url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attachments_meeting ON public.research_meeting_attachments(meeting_id);
CREATE INDEX IF NOT EXISTS idx_attachments_agenda ON public.research_meeting_attachments(agenda_item_id);

ALTER TABLE public.research_meeting_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view attachments"
  ON public.research_meeting_attachments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.research_meetings m WHERE m.id = meeting_id AND public.is_research_project_member(auth.uid(), m.project_id)));
CREATE POLICY "Members can insert attachments"
  ON public.research_meeting_attachments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.research_meetings m WHERE m.id = meeting_id AND public.is_research_project_member(auth.uid(), m.project_id)));
CREATE POLICY "Members can delete attachments"
  ON public.research_meeting_attachments FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.research_meetings m WHERE m.id = meeting_id AND public.is_research_project_member(auth.uid(), m.project_id)));

-- ===== 6. Schedule items =====
CREATE TYPE public.research_schedule_status AS ENUM ('planejado','em_andamento','concluido','atrasado');

CREATE TABLE IF NOT EXISTS public.research_schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  phase text,
  start_date date,
  end_date date,
  status public.research_schedule_status NOT NULL DEFAULT 'planejado',
  position integer NOT NULL DEFAULT 0,
  linked_meeting_id uuid REFERENCES public.research_meetings(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_schedule_project ON public.research_schedule_items(project_id);

ALTER TABLE public.research_schedule_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view schedule"
  ON public.research_schedule_items FOR SELECT
  USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Members can insert schedule"
  ON public.research_schedule_items FOR INSERT
  WITH CHECK (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Members can update schedule"
  ON public.research_schedule_items FOR UPDATE
  USING (public.is_research_project_member(auth.uid(), project_id));
CREATE POLICY "Members can delete schedule"
  ON public.research_schedule_items FOR DELETE
  USING (public.is_research_project_member(auth.uid(), project_id));

CREATE TRIGGER trg_schedule_updated
  BEFORE UPDATE ON public.research_schedule_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add FK from agenda_items to schedule_items now that table exists
ALTER TABLE public.research_meeting_agenda_items
  ADD CONSTRAINT research_meeting_agenda_items_source_schedule_fkey
  FOREIGN KEY (source_schedule_item_id) REFERENCES public.research_schedule_items(id) ON DELETE SET NULL;

-- ===== 7. Storage bucket =====
INSERT INTO storage.buckets (id, name, public)
  VALUES ('research-meetings', 'research-meetings', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Members can read meeting files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'research-meetings'
    AND EXISTS (
      SELECT 1 FROM public.research_projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND public.is_research_project_member(auth.uid(), p.id)
    )
  );
CREATE POLICY "Members can upload meeting files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'research-meetings'
    AND EXISTS (
      SELECT 1 FROM public.research_projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND public.is_research_project_member(auth.uid(), p.id)
    )
  );
CREATE POLICY "Members can delete meeting files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'research-meetings'
    AND EXISTS (
      SELECT 1 FROM public.research_projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND public.is_research_project_member(auth.uid(), p.id)
    )
  );
