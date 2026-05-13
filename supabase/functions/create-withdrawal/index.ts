import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return new Response('Unauthorized', { status: 401, headers: CORS });

    const { amount } = await req.json(); // dollars
    if (!amount || amount < 5) {
      return new Response('Minimum withdrawal is $5', { status: 400, headers: CORS });
    }

    // Uses the request_withdrawal SQL function — atomic balance deduction + request insert
    const { data, error } = await supabase.rpc('request_withdrawal', {
      p_user_id: user.id,
      p_amount: amount,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    return new Response(JSON.stringify({ request_id: data, message: 'Withdrawal request submitted. Funds typically arrive within 2–3 business days.' }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
});
