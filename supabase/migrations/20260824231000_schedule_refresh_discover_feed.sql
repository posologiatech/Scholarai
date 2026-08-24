-- Refreshes the Discover feed in the background every 6 hours. DOI-based
-- dedup inside refresh-discover-feed means repeat ticks are cheap once the
-- feed is populated (only genuinely new papers trigger AI generation).
DO $$ BEGIN
  PERFORM cron.unschedule('refresh-discover-feed-scheduler');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'refresh-discover-feed-scheduler',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://opogckyuwexdlczfvvtb.supabase.co/functions/v1/refresh-discover-feed',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wb2dja3l1d2V4ZGxjemZ2dnRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDg3NjcsImV4cCI6MjA4NzQ4NDc2N30.N1z9sOvwLuGmnZLRtovBJ2b1Y9TFKOpDG0k-VnJ0Lng"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
