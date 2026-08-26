-- Form version history for the Data Collection builder (Phase 3's last item). A version is a
-- full snapshot of a survey's core fields + blocks + questions + logic rules, taken manually
-- (a "Salvar versão" action) or automatically right before a publish/close status change.

CREATE TABLE public.survey_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  label text,
  trigger_type text NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'publish', 'close', 'pre_restore')),
  snapshot jsonb NOT NULL
);
CREATE INDEX idx_survey_versions_survey_id ON public.survey_versions (survey_id, created_at DESC);
ALTER TABLE public.survey_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Survey owners can view versions" ON public.survey_versions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.surveys s WHERE s.id = survey_versions.survey_id
      AND (s.user_id = auth.uid() OR (s.workspace_id IS NOT NULL AND public.is_workspace_member(auth.uid(), s.workspace_id)))
  )
);
CREATE POLICY "Survey owners can insert versions" ON public.survey_versions FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.surveys s WHERE s.id = survey_versions.survey_id
      AND (s.user_id = auth.uid() OR (s.workspace_id IS NOT NULL AND public.is_workspace_member(auth.uid(), s.workspace_id)))
  )
);
CREATE POLICY "Survey owners can delete versions" ON public.survey_versions FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.surveys s WHERE s.id = survey_versions.survey_id
      AND (s.user_id = auth.uid() OR (s.workspace_id IS NOT NULL AND public.is_workspace_member(auth.uid(), s.workspace_id)))
  )
);

-- Restores a survey to an earlier version, atomically, with one hard safety rule: a question
-- that already has real respondent answers recorded against it is NEVER deleted, even if the
-- version being restored doesn't include it — survey_answers.question_id is
-- ON DELETE CASCADE, so deleting the question would permanently destroy that collected data.
-- A block that contains such a protected question is likewise kept (deleting the block would
-- cascade-delete the question underneath it). Logic rules have no such downstream cascade to
-- respondent data, so they're simply replaced wholesale by the snapshot's rules.
CREATE OR REPLACE FUNCTION public.restore_survey_version(_version_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey_id uuid;
  v_snapshot jsonb;
  v_authorized boolean;
  v_protected_question_ids uuid[];
  v_protected_block_ids uuid[];
  v_deleted_block_count int := 0;
  v_deleted_question_count int := 0;
BEGIN
  SELECT survey_id, snapshot INTO v_survey_id, v_snapshot
  FROM public.survey_versions WHERE id = _version_id;

  IF v_survey_id IS NULL THEN
    RAISE EXCEPTION 'Version not found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.surveys s WHERE s.id = v_survey_id
      AND (s.user_id = auth.uid() OR (s.workspace_id IS NOT NULL AND public.is_workspace_member(auth.uid(), s.workspace_id)))
  ) INTO v_authorized;
  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT question_id), ARRAY[]::uuid[]) INTO v_protected_question_ids
  FROM public.survey_answers
  WHERE question_id IN (SELECT id FROM public.survey_questions WHERE survey_id = v_survey_id);

  SELECT COALESCE(array_agg(DISTINCT block_id), ARRAY[]::uuid[]) INTO v_protected_block_ids
  FROM public.survey_questions
  WHERE id = ANY(v_protected_question_ids);

  WITH snapshot_block_ids AS (
    SELECT (b->>'id')::uuid AS id FROM jsonb_array_elements(v_snapshot->'blocks') b
  ),
  to_delete AS (
    SELECT id FROM public.survey_blocks
    WHERE survey_id = v_survey_id
      AND id NOT IN (SELECT id FROM snapshot_block_ids)
      AND NOT (id = ANY(v_protected_block_ids))
  )
  DELETE FROM public.survey_blocks WHERE id IN (SELECT id FROM to_delete);
  GET DIAGNOSTICS v_deleted_block_count = ROW_COUNT;

  WITH snapshot_question_ids AS (
    SELECT (q->>'id')::uuid AS id FROM jsonb_array_elements(v_snapshot->'questions') q
  ),
  to_delete AS (
    SELECT id FROM public.survey_questions
    WHERE survey_id = v_survey_id
      AND id NOT IN (SELECT id FROM snapshot_question_ids)
      AND NOT (id = ANY(v_protected_question_ids))
  )
  DELETE FROM public.survey_questions WHERE id IN (SELECT id FROM to_delete);
  GET DIAGNOSTICS v_deleted_question_count = ROW_COUNT;

  DELETE FROM public.survey_logic_rules WHERE survey_id = v_survey_id;

  INSERT INTO public.survey_blocks (id, survey_id, title, description, block_order, randomize_questions, settings)
  SELECT (b->>'id')::uuid, v_survey_id, COALESCE(b->>'title', 'Block'), b->>'description',
         COALESCE((b->>'block_order')::int, 0), COALESCE((b->>'randomize_questions')::boolean, false),
         COALESCE(b->'settings', '{}'::jsonb)
  FROM jsonb_array_elements(v_snapshot->'blocks') b
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title, description = EXCLUDED.description, block_order = EXCLUDED.block_order,
    randomize_questions = EXCLUDED.randomize_questions, settings = EXCLUDED.settings;

  INSERT INTO public.survey_questions (
    id, block_id, survey_id, question_type, question_text, description, question_order,
    is_required, validation_rules, choices, matrix_rows, matrix_columns, settings
  )
  SELECT (q->>'id')::uuid, (q->>'block_id')::uuid, v_survey_id, COALESCE(q->>'question_type', 'text_entry'),
         COALESCE(q->>'question_text', ''), q->>'description', COALESCE((q->>'question_order')::int, 0),
         COALESCE((q->>'is_required')::boolean, false), COALESCE(q->'validation_rules', '{}'::jsonb),
         COALESCE(q->'choices', '[]'::jsonb), COALESCE(q->'matrix_rows', '[]'::jsonb),
         COALESCE(q->'matrix_columns', '[]'::jsonb), COALESCE(q->'settings', '{}'::jsonb)
  FROM jsonb_array_elements(v_snapshot->'questions') q
  ON CONFLICT (id) DO UPDATE SET
    block_id = EXCLUDED.block_id, question_type = EXCLUDED.question_type, question_text = EXCLUDED.question_text,
    description = EXCLUDED.description, question_order = EXCLUDED.question_order, is_required = EXCLUDED.is_required,
    validation_rules = EXCLUDED.validation_rules, choices = EXCLUDED.choices, matrix_rows = EXCLUDED.matrix_rows,
    matrix_columns = EXCLUDED.matrix_columns, settings = EXCLUDED.settings;

  INSERT INTO public.survey_logic_rules (
    id, survey_id, source_question_id, source_block_id, condition, action, target_id, rule_order
  )
  SELECT (r->>'id')::uuid, v_survey_id, (r->>'source_question_id')::uuid, (r->>'source_block_id')::uuid,
         COALESCE(r->'condition', '{}'::jsonb), COALESCE(r->>'action', 'show_block'),
         (r->>'target_id')::uuid, COALESCE((r->>'rule_order')::int, 0)
  FROM jsonb_array_elements(v_snapshot->'logic_rules') r;

  UPDATE public.surveys SET
    title = COALESCE(v_snapshot->'survey'->>'title', title),
    description = v_snapshot->'survey'->>'description',
    settings = COALESCE(v_snapshot->'survey'->'settings', settings),
    updated_at = now()
  WHERE id = v_survey_id;

  RETURN jsonb_build_object(
    'deleted_blocks', v_deleted_block_count,
    'deleted_questions', v_deleted_question_count,
    'kept_protected_questions', COALESCE(array_length(v_protected_question_ids, 1), 0)
  );
END;
$$;

-- Client calls this via supabase.rpc(...) — without an explicit grant, `authenticated` can't
-- invoke it at all, matching this project's existing convention for RPC-callable functions
-- (see get_distribution_by_token). Never grant to anon — only the survey owner/workspace
-- restores a version, and the function's own auth.uid() check enforces that regardless.
GRANT EXECUTE ON FUNCTION public.restore_survey_version(uuid) TO authenticated;
