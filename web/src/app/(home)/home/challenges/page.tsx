'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Challenge, daysLeft, effectiveStatus, getMyActiveChallenges, getPublicFeed, startsIn } from '@/lib/api';

export default function ChallengesPage() {
  const [mine, setMine] = useState<Challenge[]>([]);
  const [feed, setFeed] = useState<Challenge[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMyActiveChallenges(), getPublicFeed()])
      .then(([m, f]) => { setMine(m); setFeed(f); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const q = search.toLowerCase();
  const filtered = feed.filter(c => c.goal.toLowerCase().includes(q));

  return (
    <div style={{ padding: '12px 16px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#EFEFEF' }}>Challenges</h1>
        <Link href="/home/challenges/create" style={{ backgroundColor: '#39FF7A', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 800, color: '#0C0C0C' }}>
          + Create
        </Link>
      </div>

      <div className="inp-wrap" style={{ marginBottom: 14, display: 'flex', alignItems: 'center' }}>
        <input
          style={{ flex: 1, background: 'transparent', padding: '10px 14px', fontSize: 13, color: '#EFEFEF', width: '100%' }}
          placeholder="Search challenges..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}><span style={{ color: '#39FF7A' }}>Loading…</span></div>
      ) : (
        <>
          {mine.length > 0 && (
            <>
              <span className="section-tag">YOUR ACTIVE</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {mine.map(c => {
                  const status = effectiveStatus(c);
                  const dotColor = status === 'voting' ? '#F59E0B' : status === 'pending' ? '#555' : '#39FF7A';
                  return (
                    <Link key={c.id} href={`/home/challenges/${c.id}`} className="card" style={{ display: 'block' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div className={status === 'live' ? 'live-pill' : 'live-pill live-pill-dim'}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: dotColor }} />
                          <span style={{ fontSize: 8, fontWeight: 700, color: dotColor }}>{status === 'voting' ? 'Voting' : status === 'pending' ? 'Soon' : 'Live'}</span>
                        </div>
                        <span style={{ fontSize: 9, color: '#333333' }}>{c.type === 'private' ? '🔒' : '🌐'}</span>
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#EFEFEF', marginBottom: 10 }}>{c.goal}</p>
                      <div className="shimmer" />
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[['$' + c.pot.toFixed(0), 'Pot'], ['$' + c.bet_amount.toFixed(0), 'Bet'], [daysLeft(c.ends_at) + 'd', 'Left'], [String(c.participant_count), 'Players']].map(([v, l]) => (
                          <div key={l} className="stat-box">
                            <span style={{ fontSize: 14, fontWeight: 800, color: '#39FF7A' }}>{v}</span>
                            <span style={{ fontSize: 8, color: '#333', marginTop: 2 }}>{l}</span>
                          </div>
                        ))}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          <span className="section-tag" style={{ marginTop: mine.length > 0 ? 12 : 0 }}>PUBLIC FEED</span>

          {filtered.length === 0 ? (
            <p style={{ color: '#333333', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
              {search ? 'No challenges match.' : 'No public challenges yet.'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(c => {
                const timeLabel = effectiveStatus(c) === 'live' ? 'Status' : 'Starts in';
                return (
                <div key={c.id} className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div className="av-dim" style={{ width: 28, height: 28, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 8, fontWeight: 700, color: '#555' }}>{c.profiles?.initials ?? '?'}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#D0D0D0' }}>{c.profiles?.name ?? 'Unknown'}</p>
                      <p style={{ fontSize: 9, color: '#333' }}>creator</p>
                    </div>
                    <div style={{ backgroundColor: '#0F1A14', borderRadius: 20, padding: '3px 8px', border: '1px solid #1E3025' }}>
                      <span style={{ fontSize: 9, color: '#3A6A4A' }}>🌐 Public</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#EFEFEF', marginBottom: 10 }}>{c.goal}</p>
                  <div className="shimmer" />
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {[['$' + c.bet_amount.toFixed(0), 'Bet'], [String(c.participant_count), 'Joined'], [startsIn(c.starts_at), timeLabel]].map(([v, l]) => (
                      <div key={l} className="stat-box">
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#39FF7A' }}>{v}</span>
                        <span style={{ fontSize: 8, color: '#333', marginTop: 2 }}>{l}</span>
                      </div>
                    ))}
                    {c.creator_fee_percent > 0 && (
                      <div className="stat-box">
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#555' }}>{c.creator_fee_percent}%</span>
                        <span style={{ fontSize: 8, color: '#333', marginTop: 2 }}>Fee</span>
                      </div>
                    )}
                  </div>
                  <Link href={`/home/challenges/${c.id}`} style={{ display: 'block', textAlign: 'center', padding: '10px', fontSize: 12, fontWeight: 700, color: '#39FF7A', backgroundColor: '#0D1F11', borderRadius: 8, borderTop: '1.5px solid #3A7A45', borderLeft: '1.5px solid #2A6035', borderRight: '1.5px solid #0E1F12', borderBottom: '1.5px solid #091508' }}>
                    Join for ${c.bet_amount.toFixed(0)} →
                  </Link>
                </div>
              );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
