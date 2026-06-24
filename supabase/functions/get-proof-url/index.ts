/**
 * get-proof-url — mint a short-lived signed URL for a proof video.
 *
 * Proof clips live in a private bucket. Owners can read their own directly, but
 * group peers (to flag) and assigned reviewers (to judge) cannot — so they ask
 * here. Access is decided by RLS, not by us: we read the submission row using the
 * CALLER'S token, and `submissions_select` already allows only owner / same-group
 * peer / assigned reviewer. If that read succeeds, we sign the URL with the
 * service role; otherwise we return 403.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const { submission_id } = await req.json();
    if (!submission_id) return new Response('submission_id required', { status: 400, headers: CORS });

    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    if (!token) return new Response('Unauthorized', { status: 401, headers: CORS });

    // Caller-scoped client → RLS applies. Visible row ⇒ caller is allowed to watch.
    const asUser = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: sub } = await asUser
      .from('submissions').select('video_path').eq('id', submission_id).single();

    if (!sub?.video_path) {
      return new Response('Not found or not permitted', { status: 403, headers: CORS });
    }

    // Sign with the service role (private bucket).
    const admin = createClient(url, serviceKey);
    const { data: signed, error } = await admin.storage
      .from('proofs').createSignedUrl(sub.video_path, 120); // 2 min
    if (error || !signed) throw error ?? new Error('Could not sign URL');

    return new Response(JSON.stringify({ url: signed.signedUrl }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
});
