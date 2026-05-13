import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Profile = {
  id: string;
  username: string;
  name: string;
  initials: string;
};

export type Wallet = {
  balance: number;
  locked_balance: number;
};

export type Challenge = {
  id: string;
  creator_id: string;
  goal: string;
  type: 'public' | 'private';
  bet_amount: number;
  duration_days: number;
  starts_at: string;
  ends_at: string | null;
  status: 'pending' | 'live' | 'voting' | 'completed' | 'cancelled';
  creator_fee_percent: number;
  creator_participates: boolean;
  participant_count: number;
  pot: number;
  created_at: string;
  profiles?: Profile;
};

export type Participant = {
  user_id: string;
  status: 'active' | 'won' | 'eliminated';
  profiles: Profile;
};

export type Transaction = {
  id: string;
  type: 'deposit' | 'withdrawal' | 'challenge_join' | 'win' | 'refund';
  amount: number;
  description: string;
  created_at: string;
};

export type ProfileStats = {
  won: number;
  win_rate: number;
  completed: number;
  streak: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function uid(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export function daysLeft(endsAt: string | null): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000));
}

export function startsIn(startsAt: string): string {
  const diff = new Date(startsAt).getTime() - Date.now();
  if (diff <= 0) return 'Live';
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  const remH = h % 24;
  return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
}

export function effectiveStatus(c: Pick<Challenge, 'status' | 'starts_at' | 'ends_at'>): string {
  const now = Date.now();
  if (c.status === 'pending' && new Date(c.starts_at).getTime() <= now) return 'live';
  if (c.status === 'live' && c.ends_at && new Date(c.ends_at).getTime() <= now) return 'voting';
  return c.status;
}

// ─── Auth / Profile ───────────────────────────────────────────────────────────

export async function getMyProfile(): Promise<Profile | null> {
  const id = await uid();
  if (!id) return null;
  const { data } = await supabase.from('profiles').select('id, username, name, initials').eq('id', id).single();
  return data ?? null;
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

export async function getMyWallet(): Promise<Wallet> {
  const id = await uid();
  if (!id) return { balance: 0, locked_balance: 0 };
  const { data } = await supabase.from('wallets').select('balance, locked_balance').eq('user_id', id).single();
  return data ?? { balance: 0, locked_balance: 0 };
}

export async function getMyTransactions(): Promise<Transaction[]> {
  const id = await uid();
  if (!id) return [];
  const { data } = await supabase
    .from('transactions')
    .select('id, type, amount, description, created_at')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(30);
  return data ?? [];
}

export async function depositFunds(amountDollars: number): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error('Not signed in');

  const { data, error } = await supabase.functions.invoke('create-deposit', {
    body: {
      amount: Math.round(amountDollars * 100),
      success_url: `${window.location.origin}/deposit-success`,
      cancel_url: `${window.location.origin}/deposit-cancel`,
    },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error || !data?.url) throw new Error(error?.message ?? 'Could not create checkout session');
  window.location.href = data.url;
}

export async function requestWithdrawal(amountDollars: number): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error('Not signed in');

  const { data, error } = await supabase.functions.invoke('create-withdrawal', {
    body: { amount: amountDollars },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) throw new Error(error.message ?? 'Could not submit withdrawal');
  return data?.request_id ?? '';
}

export async function processPayout(challengeId: string): Promise<void> {
  const session = await getSession();
  if (!session) throw new Error('Not signed in');
  const { error } = await supabase.functions.invoke('process-payout', {
    body: { challenge_id: challengeId },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) throw new Error(error.message ?? 'Payout processing failed');
}

// ─── Challenges ───────────────────────────────────────────────────────────────

export async function getMyActiveChallenges(): Promise<Challenge[]> {
  const id = await uid();
  if (!id) return [];

  const [{ data: partData }, { data: createdData }] = await Promise.all([
    supabase
      .from('challenge_participants')
      .select('challenges(*, profiles!creator_id(id, username, name, initials))')
      .eq('user_id', id)
      .eq('status', 'active'),
    supabase
      .from('challenges')
      .select('*, profiles!creator_id(id, username, name, initials)')
      .eq('creator_id', id)
      .eq('creator_participates', false)
      .in('status', ['pending', 'live', 'voting']),
  ]);

  const fromParticipant = (partData as unknown as Array<{ challenges: Challenge | null }> ?? [])
    .map(row => row.challenges)
    .filter((c): c is Challenge => c !== null)
    .filter(c => ['pending', 'live', 'voting'].includes(effectiveStatus(c)));

  const fromCreated = (createdData ?? []) as Challenge[];

  const seen = new Set<string>();
  const result: Challenge[] = [];
  for (const c of [...fromParticipant, ...fromCreated]) {
    if (!seen.has(c.id)) { seen.add(c.id); result.push(c); }
  }
  return result;
}

export async function getPublicFeed(): Promise<Challenge[]> {
  const id = await uid();
  const feedQuery = supabase
    .from('challenges')
    .select('*, profiles!creator_id(id, username, name, initials)')
    .eq('type', 'public')
    .in('status', ['pending', 'live'])
    .order('created_at', { ascending: false })
    .limit(30);

  if (!id) {
    const { data } = await feedQuery;
    return data ?? [];
  }

  const [{ data }, { data: joined }] = await Promise.all([
    feedQuery,
    supabase.from('challenge_participants').select('challenge_id').eq('user_id', id),
  ]);

  if (!data) return [];
  const joinedIds = new Set((joined ?? []).map((r: { challenge_id: string }) => r.challenge_id));
  return data.filter((c: Challenge) => !joinedIds.has(c.id) && c.creator_id !== id);
}

export async function getChallengeById(challengeId: string): Promise<Challenge | null> {
  const { data } = await supabase
    .from('challenges')
    .select('*, profiles!creator_id(id, username, name, initials)')
    .eq('id', challengeId)
    .single();
  return data ?? null;
}

export async function getChallengeParticipants(challengeId: string): Promise<Participant[]> {
  const { data } = await supabase
    .from('challenge_participants')
    .select('user_id, status, profiles(id, username, name, initials)')
    .eq('challenge_id', challengeId);
  return (data ?? []) as unknown as Participant[];
}

export async function joinChallenge(challengeId: string): Promise<void> {
  const { error } = await supabase.rpc('join_challenge', { p_challenge_id: challengeId });
  if (error) throw new Error(error.message);
}

export async function createChallenge(params: {
  goal: string;
  type: 'public' | 'private';
  betAmount: number;
  durationDays: number;
  startsAt: Date;
  creatorFeePercent: number;
  creatorParticipates: boolean;
}): Promise<string> {
  const id = await uid();
  if (!id) throw new Error('Not signed in');

  const endsAt = new Date(params.startsAt.getTime() + params.durationDays * 86400000);

  const { data, error } = await supabase
    .from('challenges')
    .insert({
      creator_id: id,
      goal: params.goal,
      type: params.type,
      bet_amount: params.betAmount,
      duration_days: params.durationDays,
      starts_at: params.startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      creator_fee_percent: params.type === 'public' ? params.creatorFeePercent : 0,
      creator_participates: params.creatorParticipates,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Could not create challenge');

  if (params.creatorParticipates) {
    try {
      await joinChallenge(data.id);
    } catch (joinErr) {
      await supabase.from('challenges').delete().eq('id', data.id);
      throw joinErr;
    }
  }

  return data.id;
}

// ─── Voting ───────────────────────────────────────────────────────────────────

export async function submitVotes(
  challengeId: string,
  votes: Record<string, 'passing' | 'failing'>,
): Promise<void> {
  const id = await uid();
  if (!id) throw new Error('Not signed in');

  const rows = Object.entries(votes).map(([targetId, v]) => ({
    challenge_id: challengeId,
    voter_id: id,
    target_id: targetId,
    passed: v === 'passing',
  }));

  const { error } = await supabase.from('votes').upsert(rows, { onConflict: 'challenge_id,voter_id,target_id' });
  if (error) throw new Error(error.message);
}

export async function getMyVotes(challengeId: string): Promise<Record<string, boolean>> {
  const id = await uid();
  if (!id) return {};
  const { data } = await supabase
    .from('votes')
    .select('target_id, passed')
    .eq('challenge_id', challengeId)
    .eq('voter_id', id);
  return Object.fromEntries((data ?? []).map((v: { target_id: string; passed: boolean }) => [v.target_id, v.passed]));
}

// ─── Friends ──────────────────────────────────────────────────────────────────

export async function getMyFriends(): Promise<Profile[]> {
  const id = await uid();
  if (!id) return [];

  type FriendRow = {
    requester_id: string;
    addressee_id: string;
    requester: Profile;
    addressee: Profile;
  };

  const { data } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id, requester:profiles!requester_id(id, username, name, initials), addressee:profiles!addressee_id(id, username, name, initials)')
    .or(`requester_id.eq.${id},addressee_id.eq.${id}`)
    .eq('status', 'accepted');

  if (!data) return [];
  return (data as unknown as FriendRow[]).map(f =>
    f.requester_id === id ? f.addressee : f.requester
  ).filter(Boolean);
}

export async function sendFriendRequest(addresseeId: string): Promise<void> {
  const id = await uid();
  if (!id) throw new Error('Not signed in');
  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: id, addressee_id: addresseeId });
  if (error) throw new Error(error.message);
}

export async function getPendingRequests(): Promise<Array<{ id: string; profiles: Profile }>> {
  const id = await uid();
  if (!id) return [];
  const { data } = await supabase
    .from('friendships')
    .select('id, profiles!requester_id(id, username, name, initials)')
    .eq('addressee_id', id)
    .eq('status', 'pending');
  return (data ?? []) as unknown as Array<{ id: string; profiles: Profile }>;
}

export async function respondToFriendRequest(friendshipId: string, accept: boolean): Promise<void> {
  if (accept) {
    const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
    if (error) throw new Error(error.message);
  }
}

export async function searchUsers(query: string): Promise<Profile[]> {
  if (query.length < 2) return [];
  const id = await uid();
  const safe = query.replace(/[%_,()]/g, '');
  if (!safe) return [];
  const { data } = await supabase
    .from('profiles')
    .select('id, username, name, initials')
    .or(`username.ilike.%${safe}%,name.ilike.%${safe}%`)
    .neq('id', id ?? '')
    .limit(10);
  return data ?? [];
}

// ─── Profile stats ────────────────────────────────────────────────────────────

export async function getProfileStats(): Promise<ProfileStats> {
  const id = await uid();
  if (!id) return { won: 0, win_rate: 0, completed: 0, streak: 0 };
  const { data } = await supabase.rpc('get_profile_stats', { p_user_id: id });
  return data ?? { won: 0, win_rate: 0, completed: 0, streak: 0 };
}
