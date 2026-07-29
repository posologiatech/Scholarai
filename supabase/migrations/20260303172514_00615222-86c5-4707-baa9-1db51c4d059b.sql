-- Remove duplicate trigger to avoid inserting owner twice in workspace_members
DROP TRIGGER IF EXISTS workspaces_auto_add_owner ON public.workspaces;