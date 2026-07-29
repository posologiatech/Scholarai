-- Account-level LGPD Art. 18 self-service: export and erase all data a user
-- owns across the platform, not just inside the survey consent module.
-- Both functions sweep every public-schema table that has a `user_id` or
-- `owner_id` column, so newly added tables are covered automatically.
--
-- These are only reachable via the `account-data` edge function, which
-- authenticates the caller and invokes them with the service-role key —
-- EXECUTE is intentionally NOT granted to `authenticated`/`anon`, since the
-- functions themselves don't check auth.uid() (it reads NULL under a
-- service-role JWT, so that check can't live here without breaking the only
-- intended caller).

CREATE OR REPLACE FUNCTION public.export_user_data(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  rec record;
  table_data jsonb;
BEGIN
  FOR rec IN
    SELECT DISTINCT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name IN ('user_id', 'owner_id')
      AND t.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format(
      'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM public.%I t WHERE t.%I = $1',
      rec.table_name, rec.column_name
    ) INTO table_data USING target_user_id;

    IF jsonb_array_length(table_data) > 0 THEN
      result := result || jsonb_build_object(rec.table_name, table_data);
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user_account_data(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidates record;
  remaining text[] := ARRAY[]::text[];
  next_remaining text[];
  tbl text;
  col text;
  cols jsonb := '{}'::jsonb;
  deleted_count int;
  report jsonb := '{}'::jsonb;
  pass int := 0;
BEGIN
  FOR candidates IN
    SELECT DISTINCT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name IN ('user_id', 'owner_id')
      AND t.table_type = 'BASE TABLE'
  LOOP
    remaining := remaining || candidates.table_name;
    cols := cols || jsonb_build_object(candidates.table_name, candidates.column_name);
  END LOOP;

  -- Multiple passes so rows blocked by a not-yet-deleted FK dependency
  -- (e.g. a child table deleted before its parent) get a chance to clear
  -- once the tables ahead of them in this pass have gone.
  WHILE array_length(remaining, 1) > 0 AND pass < 8 LOOP
    pass := pass + 1;
    next_remaining := ARRAY[]::text[];
    FOREACH tbl IN ARRAY remaining LOOP
      col := cols ->> tbl;
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE %I = $1', tbl, col) USING target_user_id;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        report := report || jsonb_build_object(tbl, deleted_count);
      EXCEPTION WHEN foreign_key_violation THEN
        next_remaining := next_remaining || tbl;
      END;
    END LOOP;
    EXIT WHEN array_length(next_remaining, 1) IS NOT DISTINCT FROM array_length(remaining, 1);
    remaining := next_remaining;
  END LOOP;

  IF array_length(remaining, 1) > 0 THEN
    report := report || jsonb_build_object('_undeleted_tables', to_jsonb(remaining));
  END IF;

  RETURN report;
END;
$$;

REVOKE ALL ON FUNCTION public.export_user_data(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_user_account_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.export_user_data(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_user_account_data(uuid) TO service_role;
