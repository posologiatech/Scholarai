CREATE OR REPLACE FUNCTION public.set_research_project_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.owner_id := auth.uid();
  RETURN NEW;
END;
$$;