import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2024-06-20' });

Deno.serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '');
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const amountCents = Number(session.metadata?.amount_cents ?? 0);

    if (userId && amountCents > 0) {
      const dollars = amountCents / 100;
      const description = `Wallet deposit - ${session.id}`;

      // Idempotency: skip if this session was already processed
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('description', description)
        .maybeSingle();

      if (!existing) {
        await supabase.rpc('increment_wallet', { user_id: userId, amount: dollars });
        await supabase.from('transactions').insert({
          user_id: userId,
          type: 'deposit',
          amount: dollars,
          description,
        });
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
