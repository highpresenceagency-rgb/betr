'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Profile, ProfileStats, getMyProfile, getProfileStats } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ProfileStats>({ won: 0, win_rate: 0, completed: 0, streak: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMyProfile(), getProfileStats()])
      .then(([p, s]) => { setProfile(p); setStats(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSignOut = () => {
    supabase.auth.signOut().finally(() => router.replace('/'));
  };

  return (
    <div style={{ padding: '12px 16px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#EFEFEF', marginBottom: 16 }}>Profile</h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}><span style={{ color: '#39FF7A' }}>Loading…</span></div>
      ) : (
        <>
          <div className="card" style={{ textAlign: 'center', padding: '24px 16px', marginBottom: 14 }}>
            <div className="av-green" style={{ width: 64, height: 64, borderRadius: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#39FF7A' }}>{profile?.initials ?? '??'}</span>
            </div>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#EFEFEF', marginBottom: 4 }}>{profile?.name ?? '—'}</p>
            <p style={{ fontSize: 11, color: '#555' }}>{profile?.username ?? ''}</p>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {[
              ['$' + stats.won.toFixed(0), 'Total Won'],
              [stats.win_rate + '%', 'Win Rate'],
              [String(stats.streak), 'Streak'],
              [String(stats.completed), 'Completed'],
            ].map(([v, l]) => (
              <div key={l} className="stat-box" style={{ flex: 1 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#39FF7A' }}>{v}</span>
                <span style={{ fontSize: 8, color: '#333', marginTop: 2 }}>{l}</span>
              </div>
            ))}
          </div>

          <span className="section-tag">ACCOUNT</span>
          <div className="card" style={{ marginBottom: 14 }}>
            <Link href="/home/wallet" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #1E1E1E' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0' }}>Wallet</span>
              <span style={{ color: '#555', fontSize: 13 }}>→</span>
            </Link>
            <Link href="/home/profile/history" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0' }}>Challenge history</span>
              <span style={{ color: '#555', fontSize: 13 }}>→</span>
            </Link>
          </div>

          <button
            onClick={handleSignOut}
            style={{ display: 'block', width: '100%', padding: '13px', borderRadius: 10, backgroundColor: '#1A0A0A', border: '1.5px solid #3A1A1A', color: '#F87171', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            Sign out
          </button>
        </>
      )}
    </div>
  );
}
