select cron.schedule(
  'research-meeting-reminders',
  '*/30 * * * *',
  $$ select net.http_post(
    url:='https://opogckyuwexdlczfvvtb.supabase.co/functions/v1/research-meeting-reminders',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wb2dja3l1d2V4ZGxjemZ2dnRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDg3NjcsImV4cCI6MjA4NzQ4NDc2N30.N1z9sOvwLuGmnZLRtovBJ2b1Y9TFKOpDG0k-VnJ0Lng"}'::jsonb,
    body:=concat('{"time":"', now(), '"}')::jsonb
  ) as request_id; $$
);