-- Persistent automatic findings for DataMind (Phase 4).
--
-- The deterministic scan (remote-exec/datamind_scan.py) runs in the browser sandbox once
-- per file and costs a full pass over the data plus a few hundred statistical tests. That
-- is far too expensive to redo on every page load, and the researcher expects the findings
-- panel to still be there tomorrow — so the shortlist is stored, not recomputed.
--
-- `payload` holds the whole finding as the scan emitted it (rule, p, q, effect size, the
-- columns involved). It is stored whole on purpose: the scan's output shape belongs to the
-- statistics engine, and promoting each field to a column here would mean a migration every
-- time the engine learns to report something new. The columns that ARE promoted are only the
-- ones this table needs to index, sort or deduplicate on.

CREATE TABLE public.datamind_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.datamind_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_id uuid REFERENCES public.datamind_files(id) ON DELETE CASCADE,
  -- Stable identity built from kind + file + columns, so a re-scan of the same file
  -- updates a finding instead of stacking a second copy beside it.
  finding_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('comparison', 'correlation', 'association', 'quality')),
  significant boolean NOT NULL DEFAULT false,
  -- Set when the researcher hides a finding; kept rather than deleted so the next scan
  -- does not cheerfully bring it back.
  dismissed boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, finding_key)
);

CREATE INDEX idx_datamind_findings_conversation
  ON public.datamind_findings (conversation_id, significant DESC, created_at DESC);

ALTER TABLE public.datamind_findings ENABLE ROW LEVEL SECURITY;

-- Same ownership model as datamind_files: the row carries user_id and only its owner
-- may touch it.
CREATE POLICY "Users can view own findings" ON public.datamind_findings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own findings" ON public.datamind_findings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own findings" ON public.datamind_findings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own findings" ON public.datamind_findings
  FOR DELETE USING (auth.uid() = user_id);

-- Marks a file as already scanned. Without it a file whose scan legitimately found
-- nothing would be rescanned on every single page load — the most expensive possible
-- way to learn the same "nothing here" answer.
ALTER TABLE public.datamind_files
  ADD COLUMN findings_scanned_at timestamptz;
