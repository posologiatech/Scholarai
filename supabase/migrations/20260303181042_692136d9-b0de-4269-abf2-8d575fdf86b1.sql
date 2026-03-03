
-- Analysis versioning: checkpoints and branches
CREATE TABLE public.datamind_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.datamind_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'Checkpoint',
  description text,
  messages_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  files_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  spreadsheet_snapshot jsonb,
  parent_checkpoint_id uuid REFERENCES public.datamind_checkpoints(id) ON DELETE SET NULL,
  branch_name text DEFAULT 'main',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.datamind_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checkpoints" ON public.datamind_checkpoints FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own checkpoints" ON public.datamind_checkpoints FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own checkpoints" ON public.datamind_checkpoints FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can update own checkpoints" ON public.datamind_checkpoints FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_checkpoints_conversation ON public.datamind_checkpoints(conversation_id);
