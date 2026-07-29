-- Protocol registration + a-priori lock for systematic reviews (PROSPERO-style)
ALTER TABLE public.systematic_reviews
  ADD COLUMN pico jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN search_strategy text,
  ADD COLUMN protocol_locked_at timestamp with time zone,
  ADD COLUMN protocol_locked_by uuid,
  ADD COLUMN prospero_id text,
  ADD COLUMN protocol_document text;

-- Enforce the lock server-side: once a protocol is registered, the fields that
-- define its scope can no longer change, regardless of what the client sends.
CREATE OR REPLACE FUNCTION public.enforce_protocol_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.protocol_locked_at IS NOT NULL THEN
    IF NEW.research_question IS DISTINCT FROM OLD.research_question
      OR NEW.screening_criteria IS DISTINCT FROM OLD.screening_criteria
      OR NEW.pico IS DISTINCT FROM OLD.pico
      OR NEW.search_strategy IS DISTINCT FROM OLD.search_strategy
    THEN
      RAISE EXCEPTION 'Protocol is locked (registered at %) — research question, PICO, criteria and search strategy cannot be changed', OLD.protocol_locked_at;
    END IF;

    -- Once locked, the lock itself can't be silently cleared or reassigned either.
    IF NEW.protocol_locked_at IS DISTINCT FROM OLD.protocol_locked_at
      OR NEW.protocol_locked_by IS DISTINCT FROM OLD.protocol_locked_by
    THEN
      RAISE EXCEPTION 'A registered protocol lock cannot be modified';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_protocol_lock_trigger
BEFORE UPDATE ON public.systematic_reviews
FOR EACH ROW
EXECUTE FUNCTION public.enforce_protocol_lock();
