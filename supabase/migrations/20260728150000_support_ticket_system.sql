-- Customer support ticket system: customers open/reply to tickets from an
-- authenticated page, admins triage/reply from the admin panel, and every
-- non-admin message fires an in-app admin notification (admin_notifications)
-- so the trigger below is the single source of truth for "was this a new
-- ticket or a reply" and "should the admin be pinged" -- never the client.

-- 1. Tickets (thread metadata)
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('bug', 'billing', 'technical', 'suggestion', 'other')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  browser_info jsonb,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_tickets_user ON public.support_tickets(user_id, created_at DESC);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status, last_message_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users create own tickets" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins read all tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update all tickets" ON public.support_tickets
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Messages (every post in the thread, including the ticket's opening message)
CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id),
  is_admin_reply boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_ticket_messages_ticket ON public.support_ticket_messages(ticket_id, created_at);

GRANT SELECT, INSERT ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants read ticket messages" ON public.support_ticket_messages
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY "participants insert ticket messages" ON public.support_ticket_messages
  FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.support_tickets t
        WHERE t.id = ticket_id AND t.user_id = auth.uid()
      )
    )
  );

-- is_admin_reply is always server-stamped from the sender's actual role --
-- never trusted from the client, so a customer can't spoof an admin reply
-- to suppress their own notification.
CREATE OR REPLACE FUNCTION public.support_ticket_message_stamp_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.is_admin_reply := public.has_role(NEW.sender_id, 'admin');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_support_ticket_message_stamp_admin
  BEFORE INSERT ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.support_ticket_message_stamp_admin();

-- 3. Admin-facing notifications. Only ever populated by the trigger below --
-- there is no client INSERT policy, so this table can't be forged.
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('new_ticket', 'ticket_reply')),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_notifications_unread ON public.admin_notifications(read_at, created_at DESC);

GRANT SELECT, UPDATE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read notifications" ON public.admin_notifications
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update notifications" ON public.admin_notifications
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. After every message: bump/reopen the parent ticket, and notify admins
-- when the message is from a customer (never for the admin's own replies).
CREATE OR REPLACE FUNCTION public.support_ticket_message_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_count integer;
  v_subject text;
BEGIN
  UPDATE public.support_tickets
  SET
    last_message_at = NEW.created_at,
    updated_at = now(),
    status = CASE
      WHEN NOT NEW.is_admin_reply AND status IN ('resolved', 'closed') THEN 'open'
      ELSE status
    END,
    resolved_at = CASE WHEN NOT NEW.is_admin_reply THEN NULL ELSE resolved_at END
  WHERE id = NEW.ticket_id
  RETURNING subject INTO v_subject;

  IF NOT NEW.is_admin_reply THEN
    SELECT count(*) INTO v_message_count
    FROM public.support_ticket_messages
    WHERE ticket_id = NEW.ticket_id;

    INSERT INTO public.admin_notifications (type, ticket_id, title, body, link)
    VALUES (
      CASE WHEN v_message_count <= 1 THEN 'new_ticket' ELSE 'ticket_reply' END,
      NEW.ticket_id,
      v_subject,
      left(NEW.body, 200),
      '/admin?tab=tickets&ticket=' || NEW.ticket_id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_support_ticket_message_after_insert
  AFTER INSERT ON public.support_ticket_messages
  FOR EACH ROW EXECUTE FUNCTION public.support_ticket_message_after_insert();

-- 5. The support ticket admin panel shows a customer diagnostics panel
-- (plan, usage, AI cost history) next to the thread. subscriptions,
-- usage_tracking and ai_usage_log currently only grant a user read access to
-- their OWN rows (no has_role admin bypass), so without this an admin
-- viewing someone else's ticket would see empty diagnostics. Add explicit
-- admin-read policies; harmless if a similar policy already exists since
-- Postgres ORs multiple permissive SELECT policies together.
CREATE POLICY "admins read all subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read all usage_tracking" ON public.usage_tracking
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read all ai_usage_log" ON public.ai_usage_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
