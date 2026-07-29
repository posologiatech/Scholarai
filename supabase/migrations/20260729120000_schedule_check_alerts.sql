-- Alerts had a configurable frequency (daily/weekly/monthly) that was never enforced —
-- literature_alerts and retraction_watches only ran when a user clicked "Check Now".
-- This schedules the actual periodic run; check-alerts/run_due_alerts filters by
-- per-alert frequency and last_checked_at, so an hourly tick is safe to run.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$ BEGIN
  PERFORM cron.unschedule('check-alerts-scheduler');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'check-alerts-scheduler',
  '0 * * * *', -- every hour; run_due_alerts only acts on alerts actually due
  $$
  SELECT net.http_post(
    url := 'https://opogckyuwexdlczfvvtb.supabase.co/functions/v1/check-alerts',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wb2dja3l1d2V4ZGxjemZ2dnRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDg3NjcsImV4cCI6MjA4NzQ4NDc2N30.N1z9sOvwLuGmnZLRtovBJ2b1Y9TFKOpDG0k-VnJ0Lng"}'::jsonb,
    body := jsonb_build_object('action', 'run_due_alerts')
  );
  $$
);
