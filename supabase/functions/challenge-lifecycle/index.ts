/**
 * Challenge lifecycle manager — run on a schedule (every 5 min).
 *
 *   SELECT cron.schedule('challenge-lifecycle', '*/5 * * * *',
 *     $$SELECT net.http_post(
 *        url:='https://<project>.supabase.co/functions/v1/challenge-lifecycle',
 *        headers:'{"Authorization":"Bearer <service_role_key>"}'::jsonb) AS request_id;$$);
 *
 * Each tick:
 *  1. pending → live   (starts_at passed) → assign accountability groups + seed token
 *  2. rotate daily anti-replay tokens for all live challenges (today + tomorrow)
 *  3. keep the verification funnel unstuck (escalate stale ML / under-staffed reviews)
 *  4. live → voting   (ends_at passed)  — a grace window for in-flight reviews
 *  5. voting → completed (force-settle after the grace window)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };
const REVIEW_GRACE_HOURS = 48;  // after a challenge ends, how long reviews may run

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  if (token !== serviceKey) return new Response('Unauthorized', { status: 401, headers: CORS });

  try {
    const now = new Date().toISOString();
    const baseUrl = Deno.env.get('SUPABASE_URL') ?? '';

    // 1. pending → live, capturing ids so we can form groups + seed tokens.
    const { data: toActivate } = await supabase
      .from('challenges').select('id').eq('status', 'pending').lte('starts_at', now);

    for (const { id } of (toActivate ?? [])) {
      await supabase.from('challenges').update({ status: 'live' }).eq('id', id);
      await supabase.rpc('assign_groups', { p_challenge_id: id });
      await supabase.rpc('ensure_daily_token', { p_challenge_id: id, p_date: now.slice(0, 10) });
    }

    // 2. rotate tokens for all live challenges
    const { data: rotated } = await supabase.rpc('rotate_daily_tokens');

    // 3. keep the funnel moving
    const { data: escalated } = await supabase.rpc('escalate_stale_reviews');

    // 4. live → voting (ends_at passed)
    const { count: toVoting } = await supabase
      .from('challenges').update({ status: 'voting' })
      .eq('status', 'live').not('ends_at', 'is', null).lte('ends_at', now)
      .select('id', { count: 'exact', head: true });

    // 5. voting → completed: force-settle once the review grace window has elapsed
    const graceCutoff = new Date(Date.now() - REVIEW_GRACE_HOURS * 3600 * 1000).toISOString();
    const { data: toComplete } = await supabase
      .from('challenges').select('id').eq('status', 'voting').lte('ends_at', graceCutoff);

    let completed = 0;
    for (const { id } of (toComplete ?? [])) {
      try {
        await fetch(`${baseUrl}/functions/v1/process-payout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ challenge_id: id, force: true }),
        });
        completed++;
      } catch { /* retry next tick */ }
    }

    return new Response(JSON.stringify({
      activated: (toActivate ?? []).length, tokensRotated: rotated, escalated, toVoting, completed,
    }), { headers: { 'Content-Type': 'application/json', ...CORS } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
});
