
ALTER TABLE public.research_projects
  ADD COLUMN IF NOT EXISTS category text
  CHECK (category IN ('ic','tcc','pos_graduacao','extensao','monitoria','outro'))
  DEFAULT 'outro';

CREATE OR REPLACE FUNCTION public.create_research_project(
  _title text,
  _description text DEFAULT NULL,
  _cnpq_area text DEFAULT NULL,
  _keywords text[] DEFAULT ARRAY[]::text[],
  _objectives text DEFAULT NULL,
  _status public.research_project_status DEFAULT 'planejamento',
  _start_date date DEFAULT NULL,
  _end_date date DEFAULT NULL,
  _category text DEFAULT 'outro'
)
RETURNS public.research_projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.research_projects;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.research_projects (
    owner_id, title, description, cnpq_area, keywords, objectives,
    status, start_date, end_date, category
  )
  VALUES (
    _uid,
    trim(_title),
    NULLIF(trim(COALESCE(_description, '')), ''),
    NULLIF(trim(COALESCE(_cnpq_area, '')), ''),
    COALESCE(_keywords, ARRAY[]::text[]),
    NULLIF(trim(COALESCE(_objectives, '')), ''),
    COALESCE(_status, 'planejamento'),
    _start_date,
    _end_date,
    COALESCE(NULLIF(trim(COALESCE(_category, '')), ''), 'outro')
  )
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_research_project(text, text, text, text[], text, public.research_project_status, date, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_research_project(text, text, text, text[], text, public.research_project_status, date, date, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_research_project(text, text, text, text[], text, public.research_project_status, date, date, text) TO authenticated;
