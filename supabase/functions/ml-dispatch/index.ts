/**
 * ml-dispatch — best-effort low-latency kick to the verification worker.
 *
 * The client calls this right after `create_submission`. It verifies the caller
 * actually owns that submission, then fires the worker's /process endpoint. If
 * the worker is down or this fails, it's harmless: the worker's poller will pick
 * the row up on its next tick. This function NEVER decides anything itself.
 *
 * Env: ML_WORKER_URL (e.g. https://worker.example.com), ML_WORKER_TOKEN (shared
 * secret the worker checks), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const { submission_id } = await req.json();
    if (!submission_id) return new Response('submission_id required', { status: 400, headers: CORS });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify caller owns this submission (defense in depth; RLS also applies).
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return new Response('Unauthorized', { status: 401, headers: CORS });

    const { data: sub } = await supabase
      .from('submissions').select('id, user_id, status').eq('id', submission_id).single();
    if (!sub || sub.user_id !== user.id) {
      return new Response('Not your submission', { status: 403, headers: CORS });
    }

    const workerUrl = Deno.env.get('ML_WORKER_URL');
    if (workerUrl) {
      // fire-and-forget; don't block the client on ML latency
      fetch(`${workerUrl}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Worker-Token': Deno.env.get('ML_WORKER_TOKEN') ?? '' },
        body: JSON.stringify({ submission_id }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ dispatched: true }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
});
