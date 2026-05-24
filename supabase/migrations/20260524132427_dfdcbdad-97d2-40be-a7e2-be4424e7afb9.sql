CREATE OR REPLACE FUNCTION public.set_research_project_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN
    NEW.owner_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_owner_on_research_projects ON public.research_projects;
CREATE TRIGGER set_owner_on_research_projects
BEFORE INSERT ON public.research_projects
FOR EACH ROW EXECUTE FUNCTION public.set_research_project_owner();

ALTER TABLE public.research_projects ALTER COLUMN owner_id DROP NOT NULL;