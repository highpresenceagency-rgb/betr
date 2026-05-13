'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Challenge, Participant, Profile,
  daysLeft, effectiveStatus,
  getChallengeById, getChallengeParticipants, joinChallenge, getMyProfile,
} from '@/lib/api';

export default function ChallengeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([getChallengeById(id), getChallengeParticipants(id), getMyProfile()])
      .then(([c, p, m]) => {
        setChallenge(c);
        setParticipants(p);
        setMe(m);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const status = challenge ? effectiveStatus(challenge) : '';
  const myParticipant = me ? participants.find(p => p.user_id === me.id) : undefined;
  const amParticipant = !!myParticipant;
  const amCreator = me && challenge ? me.id === challenge.creator_id : false;

  const handleJoin = async () => {
    setJoining(true);
    setErr('');
    try {
      await joinChallenge(id);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Could not join');
      setJoining(false);
      return;
    }
    try {
      const [c, p] = await Promise.all([getChallengeById(id), getChallengeParticipants(id)]);
      setChallenge(c);
      setParticipants(p);
    } catch {
      // join succeeded; refresh failed — page data is stale but join is real
    }
    setJoining(false);
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px 0' }}><span style={{ color: '#39FF7A' }}>Loading…</span></div>;
  }

  if (!challenge) {
    return (
      <div style={{ padding: '20px 16px' }}>
        <p style={{ color: '#555', textAlign: 'center' }}>Challenge not found.</p>
        <Link href="/home/challenges" style={{ display: 'block', textAlign: 'center', color: '#39FF7A', marginTop: 12 }}>← Back</Link>
      </div>
    );
  }

  const dotColor = status === 'voting' ? '#F59E0B' : (status === 'pending' || status === 'cancelled') ? '#555' : '#39FF7A';
  const left = daysLeft(challenge.ends_at);

  return (
    <div style={{ padding: '12px 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => router.back()} style={{ color: '#555', fontSize: 20, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>←</button>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: '#EFEFEF', flex: 1 }}>Challenge Detail</h1>
        {amCreator && challenge.type === 'private' && (status === 'pending' || status === 'live') && (
          <Link href={`/home/challenges/${id}/invite`} style={{ fontSize: 11, fontWeight: 700, color: '#39FF7A' }}>Invite →</Link>
        )}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div className={status === 'live' ? 'live-pill' : 'live-pill live-pill-dim'}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: dotColor }} />
            <span style={{ fontSize: 8, fontWeight: 700, color: dotColor }}>
              {status === 'voting' ? 'Voting' : status === 'pending' ? 'Soon' : status === 'completed' ? 'Done' : status === 'cancelled' ? 'Cancelled' : 'Live'}
            </span>
          </div>
          <span style={{ fontSize: 9, color: '#555' }}>{challenge.type === 'private' ? '🔒 Private' : '🌐 Public'}</span>
        </div>

        <p style={{ fontSize: 16, fontWeight: 700, color: '#EFEFEF', marginBottom: 12, lineHeight: '22px' }}>{challenge.goal}</p>

        <div className="shimmer" />

        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          {[
            ['$' + challenge.pot.toFixed(0), 'Pot'],
            ['$' + challenge.bet_amount.toFixed(0), 'Bet'],
            [left + 'd', 'Left'],
            [String(challenge.participant_count), 'Players'],
          ].map(([v, l]) => (
            <div key={l} className="stat-box">
              <span style={{ fontSize: 14, fontWeight: 800, color: '#39FF7A' }}>{v}</span>
              <span style={{ fontSize: 8, color: '#333', marginTop: 2 }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      <span className="section-tag">PARTICIPANTS</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {participants.length === 0 ? (
          <p style={{ color: '#333', fontSize: 12, padding: '10px 0' }}>No participants yet.</p>
        ) : (
          participants.map((p, i) => (
            <div key={p.user_id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#555', width: 16 }}>#{i + 1}</span>
              <div className="av-dim" style={{ width: 28, height: 28, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#555' }}>{p.profiles.initials}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#D0D0D0' }}>{p.profiles.name}</p>
                <p style={{ fontSize: 9, color: '#333' }}>{p.profiles.username}</p>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {p.user_id === me?.id && <span style={{ fontSize: 9, color: '#39FF7A', fontWeight: 700 }}>YOU</span>}
                {p.status === 'won' && <span style={{ fontSize: 9, color: '#39FF7A' }}>✓ Won</span>}
                {p.status === 'eliminated' && <span style={{ fontSize: 9, color: '#F87171' }}>✗ Out</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {err && <p style={{ fontSize: 12, color: '#F87171', textAlign: 'center', marginBottom: 12 }}>{err}</p>}

      {status === 'voting' && amParticipant && (
        <Link
          href={`/vote?challenge=${id}`}
          style={{ display: 'block', textAlign: 'center', padding: '14px', fontSize: 13, fontWeight: 800, color: '#F59E0B', backgroundColor: '#1A1200', borderRadius: 10, border: '1.5px solid #3A3000', marginBottom: 10 }}
        >
          Vote on participants →
        </Link>
      )}

      {status === 'completed' && myParticipant?.status === 'won' && (
        <Link
          href={`/home/profile/payout?challenge=${id}`}
          style={{ display: 'block', textAlign: 'center', padding: '14px', fontSize: 13, fontWeight: 800, color: '#39FF7A', backgroundColor: '#0D1F11', borderRadius: 10, border: '1.5px solid #1E3025', marginBottom: 10 }}
        >
          🏆 Collect your winnings →
        </Link>
      )}

      {!amParticipant && !amCreator && (status === 'pending' || status === 'live') && (
        <button
          className="btn-primary"
          onClick={handleJoin}
          disabled={joining}
        >
          {joining ? 'Joining…' : `Join for $${challenge.bet_amount.toFixed(0)} →`}
        </button>
      )}

      {amCreator && challenge.type === 'private' && (status === 'pending' || status === 'live') && (
        <Link
          href={`/home/challenges/${id}/invite`}
          className="btn-ghost"
          style={{ display: 'block', textAlign: 'center' }}
        >
          Share invite link →
        </Link>
      )}
    </div>
  );
}
