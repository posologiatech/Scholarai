-- The owner/PI row auto-created by trg_research_projects_owner never populated
-- full_name or invited_email, so it always rendered as "—" in Team/CRediT tabs.
-- Backfill existing rows from auth.users, and fix the trigger going forward.

UPDATE public.research_project_members m
SET
  full_name = COALESCE(m.full_name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  invited_email = COALESCE(m.invited_email, u.email)
FROM auth.users u
WHERE m.user_id = u.id
  AND m.full_name IS NULL;

CREATE OR REPLACE FUNCTION public.auto_add_research_project_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _full_name TEXT;
  _email TEXT;
BEGIN
  SELECT COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name'), email
  INTO _full_name, _email
  FROM auth.users WHERE id = NEW.owner_id;

  INSERT INTO public.research_project_members (project_id, user_id, role, accepted, full_name, invited_email)
  VALUES (NEW.id, NEW.owner_id, 'pi', true, _full_name, _email)
  ON CONFLICT (project_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
