/**
 * process-payout — settle a finished challenge.
 *
 * Outcomes are now decided by COMPLETION (did each player meet the challenge?),
 * not by peer votes. All the money logic lives in the atomic `settle_challenge`
 * SQL function; this endpoint only does auth and forwards.
 *
 *   • Creator-triggered  → force = false (won't settle while proof is still in
 *                          review; returns {status:'pending_reviews'}).
 *   • Service-triggered   → may pass force = true (lifecycle cron, after grace).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    const { challenge_id, force } = await req.json();
    if (!challenge_id) return new Response('challenge_id required', { status: 400, headers: CORS });

    const { data: challenge } = await supabase
      .from('challenges').select('id, creator_id, status').eq('id', challenge_id).single();
    if (!challenge) return new Response('Challenge not found', { status: 404, headers: CORS });

    // Auth: service role (cron) or the challenge creator. Only the service role
    // may force-settle (closing the review window early would otherwise let a
    // creator fail players whose proof is still pending).
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const isService = token === serviceKey;
    if (!isService) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user || user.id !== challenge.creator_id) {
        return new Response('Only the challenge creator can process payouts', { status: 403, headers: CORS });
      }
    }

    const { data, error } = await supabase.rpc('settle_challenge', {
      p_challenge_id: challenge_id,
      p_force: isService ? !!force : false,
    });
    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
});
