
-- Feature 4: Data Cleaning Profiles
CREATE TABLE public.datamind_cleaning_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  conversation_id UUID REFERENCES public.datamind_conversations(id) ON DELETE CASCADE,
  file_id UUID REFERENCES public.datamind_files(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Perfil de Limpeza',
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  transformations JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.datamind_cleaning_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cleaning profiles" ON public.datamind_cleaning_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own cleaning profiles" ON public.datamind_cleaning_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cleaning profiles" ON public.datamind_cleaning_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cleaning profiles" ON public.datamind_cleaning_profiles FOR DELETE USING (auth.uid() = user_id);

-- Feature 6: Collaborative Analysis - share conversations with other users
CREATE TABLE public.datamind_conversation_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.datamind_conversations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  shared_with_email TEXT NOT NULL,
  shared_with_user_id UUID,
  permission TEXT NOT NULL DEFAULT 'view',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.datamind_conversation_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage shares" ON public.datamind_conversation_shares FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Shared users can view shares" ON public.datamind_conversation_shares FOR SELECT USING (auth.uid() = shared_with_user_id);

-- Feature 6: Comments on specific messages
CREATE TABLE public.datamind_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.datamind_conversations(id) ON DELETE CASCADE,
  message_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_email TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.datamind_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversation participants can view comments" ON public.datamind_comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM datamind_conversations c WHERE c.id = datamind_comments.conversation_id AND c.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM datamind_conversation_shares s WHERE s.conversation_id = datamind_comments.conversation_id AND s.shared_with_user_id = auth.uid())
);
CREATE POLICY "Authenticated users can insert comments" ON public.datamind_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.datamind_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.datamind_comments FOR DELETE USING (auth.uid() = user_id);

-- Allow shared users to view conversations and messages
CREATE POLICY "Shared users can view conversations" ON public.datamind_conversations FOR SELECT USING (
  EXISTS (SELECT 1 FROM datamind_conversation_shares s WHERE s.conversation_id = datamind_conversations.id AND s.shared_with_user_id = auth.uid())
);

CREATE POLICY "Shared users can view messages" ON public.datamind_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM datamind_conversation_shares s WHERE s.conversation_id = datamind_messages.conversation_id AND s.shared_with_user_id = auth.uid())
);

-- Shared users with 'edit' permission can insert messages
CREATE POLICY "Shared editors can insert messages" ON public.datamind_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM datamind_conversation_shares s WHERE s.conversation_id = datamind_messages.conversation_id AND s.shared_with_user_id = auth.uid() AND s.permission = 'edit')
);
