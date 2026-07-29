
-- Fix: All RLS policies on workspace tables were created as RESTRICTIVE instead of PERMISSIVE
-- Restrictive-only policies always deny access. We need to recreate them as PERMISSIVE.

-- workspaces
DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Members can view workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can update workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can delete workspaces" ON public.workspaces;

CREATE POLICY "Authenticated users can create workspaces" ON public.workspaces FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Members can view workspaces" ON public.workspaces FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), id));
CREATE POLICY "Owners can update workspaces" ON public.workspaces FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete workspaces" ON public.workspaces FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- workspace_members
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners and advisors can invite members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can remove members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can accept own invitations" ON public.workspace_members;

CREATE POLICY "Members can view workspace members" ON public.workspace_members FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Owners and advisors can invite members" ON public.workspace_members FOR INSERT TO authenticated WITH CHECK (get_workspace_role(auth.uid(), workspace_id) IN ('owner', 'advisor'));
CREATE POLICY "Owners can remove members" ON public.workspace_members FOR DELETE TO authenticated USING (get_workspace_role(auth.uid(), workspace_id) = 'owner' OR auth.uid() = user_id);
CREATE POLICY "Users can accept own invitations" ON public.workspace_members FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- workspace_annotations
DROP POLICY IF EXISTS "Members can create annotations" ON public.workspace_annotations;
DROP POLICY IF EXISTS "Members can view annotations" ON public.workspace_annotations;
DROP POLICY IF EXISTS "Users can delete own annotations" ON public.workspace_annotations;
DROP POLICY IF EXISTS "Users can update own annotations" ON public.workspace_annotations;

CREATE POLICY "Members can create annotations" ON public.workspace_annotations FOR INSERT TO authenticated WITH CHECK (is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = user_id);
CREATE POLICY "Members can view annotations" ON public.workspace_annotations FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can delete own annotations" ON public.workspace_annotations FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own annotations" ON public.workspace_annotations FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- workspace_activity
DROP POLICY IF EXISTS "Members can log activity" ON public.workspace_activity;
DROP POLICY IF EXISTS "Members can view activity" ON public.workspace_activity;

CREATE POLICY "Members can log activity" ON public.workspace_activity FOR INSERT TO authenticated WITH CHECK (is_workspace_member(auth.uid(), workspace_id) AND auth.uid() = user_id);
CREATE POLICY "Members can view activity" ON public.workspace_activity FOR SELECT TO authenticated USING (is_workspace_member(auth.uid(), workspace_id));
