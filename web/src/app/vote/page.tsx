'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Challenge, Participant, Profile, getChallengeById, getChallengeParticipants, getMyProfile, getMyVotes, submitVotes } from '@/lib/api';

function VoteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const challengeId = searchParams.get('challenge') ?? '';

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [votes, setVotes] = useState<Record<string, 'passing' | 'failing'>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!challengeId) { router.replace('/home/challenges'); return; }
    Promise.all([
      getChallengeById(challengeId),
      getChallengeParticipants(challengeId),
      getMyProfile(),
      getMyVotes(challengeId),
    ]).then(([c, p, m, existingVotes]) => {
      setChallenge(c);
      setParticipants(p);
      setMe(m);
      setVotes(Object.fromEntries(
        Object.entries(existingVotes).map(([id, passed]) => [id, passed ? 'passing' : 'failing'])
      ) as Record<string, 'passing' | 'failing'>);
      if (Object.keys(existingVotes).length > 0) setSubmitted(true);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [challengeId, router]);

  const others = participants.filter(p => p.user_id !== me?.id);
  const allVoted = others.length > 0 && others.every(p => votes[p.user_id]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setErr('');
    try {
      await submitVotes(challengeId, votes);
      setSubmitted(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Could not submit votes');
    }
    setSubmitting(false);
  };

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}><span style={{ color: '#39FF7A' }}>Loading…</span></div>;
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => router.back()} style={{ color: '#555', fontSize: 20, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>←</button>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#EFEFEF' }}>Cast Votes</h1>
      </div>

      {challenge && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 9, color: '#F59E0B', letterSpacing: 1, marginBottom: 4 }}>VOTING OPEN</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#EFEFEF' }}>{challenge.goal}</p>
        </div>
      )}

      <p style={{ fontSize: 11, color: '#555', marginBottom: 14, lineHeight: '16px' }}>
        Vote on whether each participant completed the challenge. Winners are decided by majority vote.
      </p>

      {submitted && (
        <div style={{ backgroundColor: '#0D1F11', borderRadius: 10, padding: 12, border: '1px solid #1E3025', marginBottom: 14 }}>
          <p style={{ fontSize: 12, color: '#39FF7A', fontWeight: 600 }}>✓ Votes submitted. You can update them below.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {others.map(p => {
          const vote = votes[p.user_id];
          return (
            <div key={p.user_id} className="card" style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div className="av-dim" style={{ width: 32, height: 32, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#555' }}>{p.profiles.initials}</span>
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#D0D0D0' }}>{p.profiles.name}</p>
                  <p style={{ fontSize: 9, color: '#333' }}>{p.profiles.username}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setVotes(v => ({ ...v, [p.user_id]: 'passing' }))}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
                    backgroundColor: vote === 'passing' ? '#0D1F11' : '#111',
                    border: `1.5px solid ${vote === 'passing' ? '#39FF7A' : '#1E1E1E'}`,
                    color: vote === 'passing' ? '#39FF7A' : '#555',
                    fontSize: 12, fontWeight: 700,
                  }}
                >
                  ✓ Completed
                </button>
                <button
                  onClick={() => setVotes(v => ({ ...v, [p.user_id]: 'failing' }))}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
                    backgroundColor: vote === 'failing' ? '#1A0A0A' : '#111',
                    border: `1.5px solid ${vote === 'failing' ? '#F87171' : '#1E1E1E'}`,
                    color: vote === 'failing' ? '#F87171' : '#555',
                    fontSize: 12, fontWeight: 700,
                  }}
                >
                  ✗ Did not
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {err && <p style={{ fontSize: 12, color: '#F87171', textAlign: 'center', marginBottom: 12 }}>{err}</p>}

      <button
        className="btn-primary"
        onClick={handleSubmit}
        disabled={!allVoted || submitting}
      >
        {submitting ? 'Submitting…' : submitted ? 'Update votes →' : 'Submit votes →'}
      </button>

      {!allVoted && (
        <p style={{ fontSize: 10, color: '#333', textAlign: 'center', marginTop: 8 }}>Vote on all participants to submit.</p>
      )}
    </>
  );
}

export default function VotePage() {
  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#0C0C0C', padding: '12px 16px 40px', maxWidth: 480, margin: '0 auto' }}>
      <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}><span style={{ color: '#39FF7A' }}>Loading…</span></div>}>
        <VoteContent />
      </Suspense>
    </div>
  );
}
