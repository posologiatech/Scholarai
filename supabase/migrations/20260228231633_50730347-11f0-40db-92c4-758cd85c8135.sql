
-- DataMind tables
CREATE TABLE public.datamind_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nova análise',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.datamind_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations" ON public.datamind_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON public.datamind_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON public.datamind_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON public.datamind_conversations FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.datamind_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.datamind_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL DEFAULT '',
  code_block TEXT,
  output_type TEXT,
  output_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.datamind_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON public.datamind_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.datamind_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
);
CREATE POLICY "Users can insert own messages" ON public.datamind_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.datamind_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
);
CREATE POLICY "Users can delete own messages" ON public.datamind_messages FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.datamind_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
);

CREATE TABLE public.datamind_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.datamind_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  schema_info JSONB DEFAULT '{}'::jsonb,
  preview_data JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.datamind_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own files" ON public.datamind_files FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own files" ON public.datamind_files FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own files" ON public.datamind_files FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can update own files" ON public.datamind_files FOR UPDATE USING (auth.uid() = user_id);

-- Storage bucket for datamind files
INSERT INTO storage.buckets (id, name, public) VALUES ('datamind-files', 'datamind-files', false);

CREATE POLICY "Users can upload datamind files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'datamind-files' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can view own datamind files" ON storage.objects FOR SELECT USING (bucket_id = 'datamind-files' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete own datamind files" ON storage.objects FOR DELETE USING (bucket_id = 'datamind-files' AND auth.uid() IS NOT NULL);

-- Trigger for updated_at on conversations
CREATE TRIGGER update_datamind_conversations_updated_at
  BEFORE UPDATE ON public.datamind_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
