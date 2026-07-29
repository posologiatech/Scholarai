
-- Create workspace roles enum
CREATE TYPE public.workspace_role AS ENUM ('owner', 'advisor', 'coauthor', 'reviewer');

-- Workspaces table
CREATE TABLE public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Workspace members table
CREATE TABLE public.workspace_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role workspace_role NOT NULL DEFAULT 'reviewer',
  invited_by UUID REFERENCES auth.users(id),
  accepted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Paper annotations/comments
CREATE TABLE public.workspace_annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  paper_id TEXT NOT NULL,
  paper_title TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  annotation_type TEXT NOT NULL DEFAULT 'comment', -- 'comment', 'note', 'highlight'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_annotations ENABLE ROW LEVEL SECURITY;

-- Activity log for screening decisions, etc.
CREATE TABLE public.workspace_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'screening_include', 'screening_exclude', 'annotation_added', 'member_invited', etc.
  paper_id TEXT,
  paper_title TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_activity ENABLE ROW LEVEL SECURITY;

-- Security definer function to check workspace membership
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id AND accepted = true
  ) OR EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = _workspace_id AND owner_id = _user_id
  )
$$;

-- Security definer function to check workspace role
CREATE OR REPLACE FUNCTION public.get_workspace_role(_user_id UUID, _workspace_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.workspaces WHERE id = _workspace_id AND owner_id = _user_id) THEN 'owner'
    ELSE (SELECT role::text FROM public.workspace_members WHERE user_id = _user_id AND workspace_id = _workspace_id AND accepted = true LIMIT 1)
  END
$$;

-- RLS Policies for workspaces
CREATE POLICY "Members can view workspaces" ON public.workspaces
  FOR SELECT USING (public.is_workspace_member(auth.uid(), id));

CREATE POLICY "Authenticated users can create workspaces" ON public.workspaces
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update workspaces" ON public.workspaces
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete workspaces" ON public.workspaces
  FOR DELETE USING (auth.uid() = owner_id);

-- RLS Policies for workspace_members
CREATE POLICY "Members can view workspace members" ON public.workspace_members
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Owners and advisors can invite members" ON public.workspace_members
  FOR INSERT WITH CHECK (
    public.get_workspace_role(auth.uid(), workspace_id) IN ('owner', 'advisor')
  );

CREATE POLICY "Users can accept own invitations" ON public.workspace_members
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Owners can remove members" ON public.workspace_members
  FOR DELETE USING (
    public.get_workspace_role(auth.uid(), workspace_id) = 'owner'
    OR auth.uid() = user_id
  );

-- RLS Policies for workspace_annotations
CREATE POLICY "Members can view annotations" ON public.workspace_annotations
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can create annotations" ON public.workspace_annotations
  FOR INSERT WITH CHECK (
    public.is_workspace_member(auth.uid(), workspace_id)
    AND auth.uid() = user_id
  );

CREATE POLICY "Users can update own annotations" ON public.workspace_annotations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own annotations" ON public.workspace_annotations
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for workspace_activity
CREATE POLICY "Members can view activity" ON public.workspace_activity
  FOR SELECT USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can log activity" ON public.workspace_activity
  FOR INSERT WITH CHECK (
    public.is_workspace_member(auth.uid(), workspace_id)
    AND auth.uid() = user_id
  );

-- Trigger for updated_at on workspaces
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on workspace_annotations
CREATE TRIGGER update_workspace_annotations_updated_at
  BEFORE UPDATE ON public.workspace_annotations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-add owner as member when workspace is created
CREATE OR REPLACE FUNCTION public.auto_add_workspace_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role, accepted)
  VALUES (NEW.id, NEW.owner_id, 'owner', true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_add_workspace_owner_trigger
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_workspace_owner();
