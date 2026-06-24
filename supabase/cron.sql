-- ════════════════════════════════════════════════════════════════════════════
-- CRON — challenge lifecycle (runs entirely in-DB; no HTTP, no service key)
-- ════════════════════════════════════════════════════════════════════════════
-- Applied live to project xzpvnkkghulalkpjusfs. run_challenge_lifecycle() is
-- created in settlement-adjacent migration 08; this schedules it.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- replace any existing job of the same name
SELECT cron.unschedule('challenge-lifecycle')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'challenge-lifecycle');

SELECT cron.schedule('challenge-lifecycle', '*/5 * * * *', $$SELECT public.run_challenge_lifecycle();$$);

-- inspect:   SELECT * FROM cron.job;
-- history:   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
-- (The challenge-lifecycle EDGE function remains deployed for manual/external
--  triggering, but the schedule uses this in-DB path.)
