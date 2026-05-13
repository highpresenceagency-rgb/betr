/**
 * Challenge lifecycle manager — call this on a schedule (every 5–15 minutes).
 *
 * In Supabase dashboard → Edge Functions → Schedule, set cron: "* /5 * * * *" (every 5 min)
 * Or call it from a pg_cron job:
 *   SELECT cron.schedule('challenge-lifecycle', '*/5 * * * *',
 *     $$SELECT net.http_post(url:='https://<project>.supabase.co/functions/v1/challenge-lifecycle',
 *       headers:'{"Authorization":"Bearer <service_role_key>"}'::jsonb) AS request_id;$$);
 *
 * What it does:
 *  1. pending → live   when starts_at <= NOW()
 *  2. live    → voting when ends_at   <= NOW()
 *  3. voting  → completed (auto-process payouts) after 48h voting window if not already done
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };
const VOTING_WINDOW_HOURS = 48;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (token !== serviceKey) {
    return new Response('Unauthorized', { status: 401, headers: CORS });
  }

  try {
    // 1. pending → live
    const { count: activated } = await supabase
      .from('challenges')
      .update({ status: 'live' })
      .eq('status', 'pending')
      .lte('starts_at', new Date().toISOString())
      .select('id', { count: 'exact', head: true });

    // 2. live → voting
    const { count: toVoting } = await supabase
      .from('challenges')
      .update({ status: 'voting' })
      .eq('status', 'live')
      .not('ends_at', 'is', null)
      .lte('ends_at', new Date().toISOString())
      .select('id', { count: 'exact', head: true });

    // 3. voting → auto-complete (after 48h voting window)
    const votingDeadline = new Date(Date.now() - VOTING_WINDOW_HOURS * 3600 * 1000).toISOString();
    const { data: toComplete } = await supabase
      .from('challenges')
      .select('id')
      .eq('status', 'voting')
      .lte('ends_at', votingDeadline);

    let completed = 0;
    const baseUrl = Deno.env.get('SUPABASE_URL') ?? '';

    for (const { id } of (toComplete ?? [])) {
      try {
        await fetch(`${baseUrl}/functions/v1/process-payout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ challenge_id: id }),
        });
        completed++;
      } catch {
        // Non-fatal — will retry next tick
      }
    }

    return new Response(JSON.stringify({ activated, toVoting, completed }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
});
