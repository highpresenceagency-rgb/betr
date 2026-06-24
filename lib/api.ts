import { Linking } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
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
  // verification config (added in verification.sql)
  cadence?: 'daily' | 'once';
  target_reps?: number | null;
  required_count?: number | null;
  allowed_misses?: number;
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

export type Friendship = {
  id: string;
  status: 'pending' | 'accepted';
  profiles: Profile;
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
  if (diff <= 0) return 'Starting';
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
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
    body: { amount: Math.round(amountDollars * 100) }, // cents
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error || !data?.url) throw new Error(error?.message ?? 'Could not create checkout session');
  await Linking.openURL(data.url);
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

// ─── Challenges ───────────────────────────────────────────────────────────────

export async function getMyActiveChallenges(): Promise<Challenge[]> {
  const id = await uid();
  if (!id) return [];

  // Challenges I'm participating in
  const { data: partData } = await supabase
    .from('challenge_participants')
    .select('challenges(*, profiles!creator_id(id, username, name, initials))')
    .eq('user_id', id)
    .eq('status', 'active');

  // Challenges I created but chose not to participate in
  const { data: createdData } = await supabase
    .from('challenges')
    .select('*, profiles!creator_id(id, username, name, initials)')
    .eq('creator_id', id)
    .eq('creator_participates', false)
    .in('status', ['pending', 'live', 'voting']);

  const fromParticipant = (partData as unknown as Array<{ challenges: Challenge | null }> ?? [])
    .map(row => row.challenges)
    .filter((c): c is Challenge => c !== null)
    .filter(c => ['pending', 'live', 'voting'].includes(effectiveStatus(c)));

  const fromCreated = (createdData ?? []) as Challenge[];

  // Deduplicate (shouldn't overlap, but defensive)
  const seen = new Set<string>();
  const result: Challenge[] = [];
  for (const c of [...fromParticipant, ...fromCreated]) {
    if (!seen.has(c.id)) { seen.add(c.id); result.push(c); }
  }
  return result;
}

export async function getPublicFeed(): Promise<Challenge[]> {
  const id = await uid();
  const { data } = await supabase
    .from('challenges')
    .select('*, profiles!creator_id(id, username, name, initials)')
    .eq('type', 'public')
    .in('status', ['pending', 'live'])
    .order('created_at', { ascending: false })
    .limit(30);

  if (!data || !id) return data ?? [];

  // Exclude challenges the current user already joined
  const { data: joined } = await supabase
    .from('challenge_participants')
    .select('challenge_id')
    .eq('user_id', id);

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
  // verification config (optional; sensible server defaults if omitted)
  cadence?: 'daily' | 'once';
  targetReps?: number | null;
  requiredCount?: number | null;
  allowedMisses?: number;
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
      cadence: params.cadence ?? 'daily',
      target_reps: params.targetReps ?? null,
      required_count: params.requiredCount ?? null,
      allowed_misses: params.allowedMisses ?? 0,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Could not create challenge');

  // If creator participates, join immediately — rollback on failure
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
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
  } else {
    await supabase.from('friendships').delete().eq('id', friendshipId);
  }
}

export async function searchUsers(query: string): Promise<Profile[]> {
  if (query.length < 2) return [];
  const id = await uid();
  const { data } = await supabase
    .from('profiles')
    .select('id, username, name, initials')
    .or(`username.ilike.%${query}%,name.ilike.%${query}%`)
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

// ════════════════════════════════════════════════════════════════════════════
// VERIFICATION FUNNEL — submissions, tokens, groups, flags, reviews
// ════════════════════════════════════════════════════════════════════════════

export type SubmissionStatus =
  | 'pending_ml' | 'auto_approved' | 'in_review' | 'approved' | 'rejected' | 'expired' | 'missed';

export type FlagReason =
  | 'sped_up' | 'cant_see_full_reps' | 'possibly_reused' | 'not_same_person' | 'other';

export type Submission = {
  id: string;
  challenge_id: string;
  user_id: string;
  group_id: string | null;
  proof_date: string;
  status: SubmissionStatus;
  ml_rep_count: number | null;
  ml_target: number | null;
  ml_suspicion: number | null;
  ml_signals?: Record<string, unknown> | null;
  token_detected: boolean | null;
  video_path: string | null;
  created_at: string;
  profiles?: Profile;
};

export type SubmissionFlag = {
  id: string;
  reason: FlagReason;
  note: string | null;
  flagger_id: string;
  created_at: string;
};

export type ReviewItem = {
  id: string;
  submission_id: string;
  kind: 'paid' | 'cross_challenge';
  due_at: string | null;
  submissions: Submission;
};

export const FLAG_LABELS: Record<FlagReason, string> = {
  sped_up: 'Looks sped up',
  cant_see_full_reps: "Can't see full reps",
  possibly_reused: 'Possibly reused',
  not_same_person: 'Not the same person',
  other: 'Something else',
};

const SUBMISSION_COLS =
  'id, challenge_id, user_id, group_id, proof_date, status, ml_rep_count, ml_target, ml_suspicion, token_detected, video_path, created_at';

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Daily anti-replay token ────────────────────────────────────────────────
// Returns today's token text (only readable on/after its day per RLS), or null
// if it hasn't been seeded yet (the lifecycle cron seeds it when a game is live).
export async function getTodayToken(challengeId: string): Promise<string | null> {
  const { data } = await supabase
    .from('daily_tokens')
    .select('token_text')
    .eq('challenge_id', challengeId)
    .eq('token_date', todayISODate())
    .maybeSingle();
  return data?.token_text ?? null;
}

// ─── Submitting proof ─────────────────────────────────────────────────────────
// Uploads an in-app-recorded clip to the private 'proofs' bucket. Path is
// {challengeId}/{userId}/... so storage RLS (foldername[2] = uid) permits it.
export async function uploadProof(challengeId: string, localUri: string): Promise<string> {
  const id = await uid();
  if (!id) throw new Error('Not signed in');

  const ext = (localUri.split('.').pop() ?? 'mp4').split('?')[0].toLowerCase();
  const stamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const path = `${challengeId}/${id}/${stamp}.${ext}`;

  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
  const { error } = await supabase.storage.from('proofs').upload(path, decode(base64), {
    contentType: ext === 'mov' ? 'video/quicktime' : 'video/mp4',
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return path;
}

// Upload + register the submission + best-effort ML kick (poller is the fallback).
export async function submitProof(challengeId: string, localUri: string, videoSeconds?: number): Promise<string> {
  const path = await uploadProof(challengeId, localUri);

  const { data, error } = await supabase.rpc('create_submission', {
    p_challenge_id: challengeId,
    p_video_path: path,
    p_video_seconds: videoSeconds ?? null,
  });
  if (error) throw new Error(error.message);
  const submissionId = data as string;

  const session = await getSession();
  if (session) {
    supabase.functions
      .invoke('ml-dispatch', {
        body: { submission_id: submissionId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      .catch(() => {}); // non-fatal; worker poller will pick it up
  }
  return submissionId;
}

export async function getMySubmissions(challengeId: string): Promise<Submission[]> {
  const id = await uid();
  if (!id) return [];
  const { data } = await supabase
    .from('submissions')
    .select(SUBMISSION_COLS)
    .eq('challenge_id', challengeId)
    .eq('user_id', id)
    .order('proof_date', { ascending: false });
  return (data ?? []) as Submission[];
}

export async function getTodaySubmission(challengeId: string): Promise<Submission | null> {
  const id = await uid();
  if (!id) return null;
  const { data } = await supabase
    .from('submissions')
    .select(SUBMISSION_COLS)
    .eq('challenge_id', challengeId)
    .eq('user_id', id)
    .eq('proof_date', todayISODate())
    .maybeSingle();
  return (data as Submission) ?? null;
}

// How close am I to winning? approved days vs required (minus allowed misses).
export async function getChallengeProgress(
  challengeId: string,
): Promise<{ approved: number; required: number; allowedMisses: number }> {
  const id = await uid();
  if (!id) return { approved: 0, required: 0, allowedMisses: 0 };

  const { count } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('challenge_id', challengeId)
    .eq('user_id', id)
    .in('status', ['approved', 'auto_approved']);

  const { data: ch } = await supabase
    .from('challenges')
    .select('cadence, required_count, duration_days, allowed_misses')
    .eq('id', challengeId)
    .single();

  const required = ch ? (ch.cadence === 'once' ? 1 : (ch.required_count ?? ch.duration_days)) : 0;
  return { approved: count ?? 0, required, allowedMisses: ch?.allowed_misses ?? 0 };
}

// ─── Accountability group ──────────────────────────────────────────────────
export async function getMyGroup(challengeId: string): Promise<{ groupId: string | null; members: Profile[] }> {
  const id = await uid();
  if (!id) return { groupId: null, members: [] };

  const { data: mine } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('challenge_id', challengeId)
    .eq('user_id', id)
    .maybeSingle();
  if (!mine?.group_id) return { groupId: null, members: [] };

  const { data } = await supabase
    .from('group_members')
    .select('user_id, profiles!user_id(id, username, name, initials)')
    .eq('group_id', mine.group_id);

  const members = (data as unknown as Array<{ profiles: Profile }> ?? [])
    .map((r) => r.profiles)
    .filter(Boolean);
  return { groupId: mine.group_id, members };
}

// Peers' submissions I'm allowed to see (and flag) in my group — newest first.
export async function getGroupFeed(challengeId: string): Promise<Submission[]> {
  const id = await uid();
  if (!id) return [];
  const { groupId } = await getMyGroup(challengeId);
  if (!groupId) return [];

  const { data } = await supabase
    .from('submissions')
    .select(`${SUBMISSION_COLS}, profiles!user_id(id, username, name, initials)`)
    .eq('group_id', groupId)
    .neq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []) as unknown as Submission[];
}

// ─── Flags ────────────────────────────────────────────────────────────────────
export async function flagSubmission(submissionId: string, reason: FlagReason, note?: string): Promise<void> {
  const { error } = await supabase.rpc('submit_flag', {
    p_submission_id: submissionId,
    p_reason: reason,
    p_note: note ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function getSubmissionFlags(submissionId: string): Promise<SubmissionFlag[]> {
  const { data } = await supabase
    .from('submission_flags')
    .select('id, reason, note, flagger_id, created_at')
    .eq('submission_id', submissionId);
  return (data ?? []) as SubmissionFlag[];
}

// ─── Watching proof (signed URL via RLS-checked edge function) ───────────────
export async function getProofUrl(submissionId: string): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase.functions.invoke('get-proof-url', {
    body: { submission_id: submissionId },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) return null;
  return data?.url ?? null;
}

// ─── Reviewer queue ─────────────────────────────────────────────────────────
export async function getMyReviewQueue(): Promise<ReviewItem[]> {
  const id = await uid();
  if (!id) return [];
  const { data } = await supabase
    .from('reviewer_assignments')
    .select(
      'id, submission_id, kind, due_at, ' +
        'submissions(id, challenge_id, user_id, group_id, proof_date, status, ml_rep_count, ml_target, ml_suspicion, ml_signals, token_detected, video_path, created_at)',
    )
    .eq('reviewer_id', id)
    .eq('status', 'assigned')
    .order('assigned_at', { ascending: true });
  return (data ?? []) as unknown as ReviewItem[];
}

export async function submitReview(
  submissionId: string,
  decision: 'approved' | 'rejected',
  reason?: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('submit_review', {
    p_submission_id: submissionId,
    p_decision: decision,
    p_reason: reason ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function getMyFlaggerReputation(): Promise<{ weight: number; upheld: number; total: number }> {
  const id = await uid();
  if (!id) return { weight: 1, upheld: 0, total: 0 };
  const { data } = await supabase
    .from('flagger_reputation')
    .select('weight, flags_upheld, flags_total')
    .eq('user_id', id)
    .maybeSingle();
  return { weight: data?.weight ?? 1, upheld: data?.flags_upheld ?? 0, total: data?.flags_total ?? 0 };
}
