'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { Challenge, Profile, daysLeft, effectiveStatus, getMyActiveChallenges, getMyProfile } from '@/lib/api';

export default function HomePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMyProfile(), getMyActiveChallenges()])
      .then(([p, c]) => { setProfile(p); setChallenges(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const firstName = profile?.name?.split(' ')[0] ?? '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ padding: '8px 16px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 12 }}>
        <div>
          <p style={{ fontSize: 9, color: '#3A3A3A', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 }}>
            {firstName ? `${greeting}, ${firstName}` : greeting}
          </p>
          <Logo size="md" />
        </div>
        <Link
          href="/home/profile"
          className="av-green"
          style={{ width: 36, height: 36, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <span style={{ fontSize: 11, fontWeight: 800, color: '#39FF7A' }}>{profile?.initials ?? '??'}</span>
        </Link>
      </div>

      <span className="section-tag">YOUR ACTIVE CHALLENGES</span>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <span style={{ color: '#39FF7A', fontSize: 13 }}>Loading…</span>
        </div>
      ) : challenges.length === 0 ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20, marginBottom: 10 }}>
          <p style={{ color: '#333333', fontSize: 13, marginBottom: 8 }}>No active challenges.</p>
          <Link href="/home/challenges" style={{ color: '#39FF7A', fontSize: 13, fontWeight: 600 }}>Browse challenges →</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {challenges.map(c => {
            const status = effectiveStatus(c);
            const left = daysLeft(c.ends_at);
            const dotColor = status === 'voting' ? '#F59E0B' : status === 'pending' ? '#555' : '#39FF7A';
            return (
              <Link key={c.id} href={`/home/challenges/${c.id}`} className="card" style={{ display: 'block' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div className={status === 'live' ? 'live-pill' : 'live-pill live-pill-dim'} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: dotColor }} />
                    <span style={{ fontSize: 8, fontWeight: 700, color: dotColor }}>
                      {status === 'voting' ? 'Voting' : status === 'pending' ? 'Soon' : 'Live'}
                    </span>
                  </div>
                  <span style={{ fontSize: 9, color: '#333333' }}>{c.type === 'private' ? '🔒 Private' : '🌐 Public'}</span>
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#EFEFEF', marginBottom: 10, lineHeight: '20px' }}>{c.goal}</p>
                <div className="shimmer" />
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['$' + c.pot.toFixed(0), 'Pot'], ['$' + c.bet_amount.toFixed(0), 'Your bet'], [left + 'd', 'Left'], [String(c.participant_count), 'Players']].map(([val, lbl]) => (
                    <div key={lbl} className="stat-box">
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#39FF7A' }}>{val}</span>
                      <span style={{ fontSize: 8, color: '#333', marginTop: 2 }}>{lbl}</span>
                    </div>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <Link href="/home/challenges" className="card" style={{ textAlign: 'center', padding: '10px', fontSize: 11, color: '#39FF7A', fontWeight: 600 }}>Browse feed</Link>
        <Link href="/home/challenges/create" className="card" style={{ textAlign: 'center', padding: '10px', fontSize: 11, color: '#39FF7A', fontWeight: 600 }}>+ Create</Link>
      </div>
    </div>
  );
}
