
-- Create user_approvals table
CREATE TABLE public.user_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT,
  full_name TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID
);

-- Enable RLS
ALTER TABLE public.user_approvals ENABLE ROW LEVEL SECURITY;

-- Users can read their own approval status
CREATE POLICY "Users can read own approval" ON public.user_approvals
  FOR SELECT USING (user_id = auth.uid());

-- Admins can read all approvals
CREATE POLICY "Admins can read all approvals" ON public.user_approvals
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update approvals
CREATE POLICY "Admins can update approvals" ON public.user_approvals
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Allow insert from trigger (service role)
CREATE POLICY "Service can insert approvals" ON public.user_approvals
  FOR INSERT WITH CHECK (true);

-- Auto-create approval record on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_approvals (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_approval
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_approval();

-- Auto-approve existing admin user
INSERT INTO public.user_approvals (user_id, email, full_name, approved, approved_at)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', ''), true, now()
FROM auth.users u
WHERE EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id AND ur.role = 'admin')
ON CONFLICT (user_id) DO UPDATE SET approved = true, approved_at = now();

-- Also insert records for any existing users who don't have one yet
INSERT INTO public.user_approvals (user_id, email, full_name, approved, approved_at)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', ''), false, null
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_approvals ua WHERE ua.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;
