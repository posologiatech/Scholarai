-- DataSUS conversation history
CREATE TABLE public.datasus_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Nova consulta',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.datasus_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.datasus_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'user',
    content TEXT NOT NULL DEFAULT '',
    explanation TEXT,
    data_source TEXT,
    disease TEXT,
    location TEXT,
    period TEXT,
    code TEXT,
    stdout TEXT,
    images JSONB DEFAULT '[]',
    tables_data JSONB DEFAULT '[]',
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_datasus_conv_user ON public.datasus_conversations(user_id, updated_at DESC);
CREATE INDEX idx_datasus_msg_conv ON public.datasus_messages(conversation_id, created_at);

ALTER TABLE public.datasus_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasus_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own datasus conversations"
ON public.datasus_conversations FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own datasus messages"
ON public.datasus_messages FOR ALL TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.datasus_conversations c
    WHERE c.id = datasus_messages.conversation_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
    SELECT 1 FROM public.datasus_conversations c
    WHERE c.id = datasus_messages.conversation_id AND c.user_id = auth.uid()
));

CREATE TRIGGER update_datasus_conversations_updated_at
    BEFORE UPDATE ON public.datasus_conversations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();