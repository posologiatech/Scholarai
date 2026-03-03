-- Reliable workspace creation via SECURITY DEFINER (bypasses client-side RLS edge cases)
CREATE OR REPLACE FUNCTION public.create_workspace(_name text, _description text DEFAULT NULL)
RETURNS public.workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.workspaces;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.workspaces (name, description, owner_id)
  VALUES (trim(_name), NULLIF(trim(COALESCE(_description, '')), ''), _uid)
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_workspace(text, text) TO authenticated;

-- Ensure owner is inserted into workspace_members on workspace creation
DROP TRIGGER IF EXISTS workspaces_auto_add_owner ON public.workspaces;
CREATE TRIGGER workspaces_auto_add_owner
AFTER INSERT ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.auto_add_workspace_owner();