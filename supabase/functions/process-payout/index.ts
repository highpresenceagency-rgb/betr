import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    const { challenge_id } = await req.json();
    if (!challenge_id) return new Response('challenge_id required', { status: 400, headers: CORS });

    const { data: challenge } = await supabase
      .from('challenges')
      .select('id, bet_amount, creator_fee_percent, creator_id, pot, goal, status')
      .eq('id', challenge_id)
      .single();

    if (!challenge) return new Response('Challenge not found', { status: 404, headers: CORS });

    // If caller is a user JWT (not service role), verify they are the creator
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (token !== serviceKey) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user || user.id !== challenge.creator_id) {
        return new Response('Only the challenge creator can process payouts', { status: 403, headers: CORS });
      }
    }

    if (challenge.status === 'completed') {
      return new Response(JSON.stringify({ message: 'Already completed' }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    const { data: participants } = await supabase
      .from('challenge_participants')
      .select('user_id')
      .eq('challenge_id', challenge_id)
      .eq('status', 'active');

    if (!participants || participants.length === 0) {
      await supabase.from('challenges').update({ status: 'completed' }).eq('id', challenge_id);
      return new Response(JSON.stringify({ message: 'No active participants' }), { headers: { 'Content-Type': 'application/json', ...CORS } });
    }

    const betAmount = Number(challenge.bet_amount);
    // Recalculate from actual participants rather than trusting the stored pot value,
    // which a creator could manipulate via the open challenges_update RLS policy.
    const pot = participants.length * betAmount;
    const feePercent = challenge.creator_fee_percent ?? 0;

    // Tally votes for each participant
    const outcomes: { user_id: string; won: boolean }[] = [];

    for (const { user_id } of participants) {
      const { data: votesForThis } = await supabase
        .from('votes')
        .select('passed')
        .eq('challenge_id', challenge_id)
        .eq('target_id', user_id);

      const total = (votesForThis ?? []).length;
      const passing = (votesForThis ?? []).filter((v: { passed: boolean }) => v.passed).length;
      const failing = total - passing;

      // Win unless strictly more votes against
      const won = total === 0 || passing >= failing;
      outcomes.push({ user_id, won });
    }

    const winners = outcomes.filter(o => o.won);
    const losers = outcomes.filter(o => !o.won);

    // If everyone fails — refund all
    if (winners.length === 0) {
      for (const { user_id } of participants) {
        await supabase.rpc('release_locked', { p_user_id: user_id, p_amount: betAmount });
        await supabase.from('transactions').insert({
          user_id, type: 'refund', amount: betAmount,
          description: `Refund: ${challenge.goal} (no winners)`,
        });
        await supabase.from('challenge_participants')
          .update({ status: 'won' }).eq('challenge_id', challenge_id).eq('user_id', user_id);
      }
      await supabase.from('challenges').update({ status: 'completed' }).eq('id', challenge_id);
      return new Response(JSON.stringify({ message: 'All refunded — no winners', refunded: participants.length }), {
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // Creator fee: only charged if creator is not a winner (avoids self-dealing)
    const creatorWon = winners.some(w => w.user_id === challenge.creator_id);
    const creatorFeeAmount = (!creatorWon && feePercent > 0) ? pot * feePercent / 100 : 0;
    const distributable = pot - creatorFeeAmount;
    const perWinnerPayout = distributable / winners.length;

    for (const { user_id } of winners) {
      const profit = perWinnerPayout - betAmount;
      if (profit >= 0) {
        // Normal case: winners take losers' stake. Release their own bet and add profit.
        await supabase.rpc('release_locked', { p_user_id: user_id, p_amount: betAmount });
        if (profit > 0) {
          await supabase.rpc('increment_wallet', { user_id, amount: profit });
        }
      } else {
        // Everyone-wins with creator fee: payout < bet. Release only what's owed,
        // forfeit the fee-cut portion so no money is created.
        await supabase.rpc('release_locked', { p_user_id: user_id, p_amount: perWinnerPayout });
        await supabase.rpc('forfeit_locked', { p_user_id: user_id, p_amount: betAmount - perWinnerPayout });
      }
      await supabase.from('transactions').insert({
        user_id, type: 'win', amount: perWinnerPayout,
        description: `Won: ${challenge.goal}`,
      });
      await supabase.from('challenge_participants')
        .update({ status: 'won' }).eq('challenge_id', challenge_id).eq('user_id', user_id);
    }

    // Forfeit losers' locked funds
    for (const { user_id } of losers) {
      await supabase.rpc('forfeit_locked', { p_user_id: user_id, p_amount: betAmount });
      await supabase.from('challenge_participants')
        .update({ status: 'eliminated' }).eq('challenge_id', challenge_id).eq('user_id', user_id);
    }

    // Pay creator fee
    if (creatorFeeAmount > 0) {
      await supabase.rpc('increment_wallet', { user_id: challenge.creator_id, amount: creatorFeeAmount });
      await supabase.from('transactions').insert({
        user_id: challenge.creator_id, type: 'win', amount: creatorFeeAmount,
        description: `Creator fee: ${challenge.goal}`,
      });
    }

    await supabase.from('challenges').update({ status: 'completed' }).eq('id', challenge_id);

    return new Response(JSON.stringify({
      winners: winners.length,
      losers: losers.length,
      per_winner_payout: perWinnerPayout.toFixed(2),
    }), { headers: { 'Content-Type': 'application/json', ...CORS } });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
});
