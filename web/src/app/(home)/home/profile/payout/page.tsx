'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Challenge, getChallengeById, processPayout } from '@/lib/api';

function PayoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const challengeId = searchParams.get('challenge') ?? '';

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!challengeId) {
      router.replace('/home/challenges');
      return;
    }
    processPayout(challengeId).catch(() => {});
    getChallengeById(challengeId)
      .then(c => setChallenge(c))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [challengeId, router]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '60px 0' }}><span style={{ color: '#39FF7A' }}>Loading…</span></div>;
  }

  const creatorFee = challenge ? (challenge.pot * challenge.creator_fee_percent) / 100 : 0;
  const netPot = challenge ? challenge.pot - creatorFee : 0;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={() => router.back()} style={{ color: '#555', fontSize: 20, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>←</button>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#EFEFEF' }}>Payout</h1>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '28px 16px', marginBottom: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: 32, border: '2px solid #39FF7A', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <span style={{ fontSize: 28 }}>🏆</span>
        </div>
        <p style={{ fontSize: 9, color: '#555', letterSpacing: 1.5, marginBottom: 6 }}>CHALLENGE COMPLETE</p>
        <p style={{ fontSize: 26, fontWeight: 800, color: '#39FF7A', marginBottom: 6 }}>You won!</p>
        {challenge && (
          <p style={{ fontSize: 13, color: '#D0D0D0', lineHeight: '18px' }}>{challenge.goal}</p>
        )}
      </div>

      {challenge && (
        <div className="card" style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 9, color: '#555', letterSpacing: 1.5, marginBottom: 10 }}>BREAKDOWN</p>
          {[
            ['Total pot', `$${challenge.pot.toFixed(2)}`],
            ...(creatorFee > 0 ? [['Creator fee (' + challenge.creator_fee_percent + '%)', `−$${creatorFee.toFixed(2)}`]] : []),
            ['Net pot', `$${netPot.toFixed(2)}`],
          ].map(([label, value], i, arr) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid #1E1E1E' : 'none' }}>
              <span style={{ fontSize: 12, color: '#555' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: i === arr.length - 1 ? '#39FF7A' : '#D0D0D0' }}>{value}</span>
            </div>
          ))}
        </div>
      )}

      <Link href="/home/wallet" className="btn-primary" style={{ display: 'block', textAlign: 'center', marginBottom: 8 }}>
        Withdraw to bank →
      </Link>

      <Link href="/home/wallet" className="btn-ghost" style={{ display: 'block', textAlign: 'center', marginBottom: 16 }}>
        Keep in wallet
      </Link>

      <Link href="/home/challenges" style={{ display: 'block', textAlign: 'center', fontSize: 12, color: '#555' }}>
        Start a new challenge →
      </Link>
    </>
  );
}

export default function PayoutPage() {
  return (
    <div style={{ padding: '12px 16px 16px' }}>
      <Suspense fallback={<div style={{ textAlign: 'center', padding: '60px 0' }}><span style={{ color: '#39FF7A' }}>Loading…</span></div>}>
        <PayoutContent />
      </Suspense>
    </div>
  );
}
