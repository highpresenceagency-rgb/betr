'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createChallenge } from '@/lib/api';

export default function CreateChallengePage() {
  const router = useRouter();
  const [goal, setGoal] = useState('');
  const [type, setType] = useState<'public' | 'private'>('public');
  const [betAmount, setBetAmount] = useState('');
  const [durationDays, setDurationDays] = useState('30');
  const [startsInDays, setStartsInDays] = useState('1');
  const [creatorFeePercent, setCreatorFeePercent] = useState('10');
  const [creatorParticipates, setCreatorParticipates] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canCreate = goal.trim().length > 3 && Number(betAmount) >= 5;

  const handleCreate = async () => {
    if (!canCreate) return;
    setLoading(true);
    setError('');
    try {
      const startsAt = new Date(Date.now() + Number(startsInDays) * 86400000);
      const id = await createChallenge({
        goal: goal.trim(),
        type,
        betAmount: Number(betAmount),
        durationDays: Number(durationDays),
        startsAt,
        creatorFeePercent: type === 'public' ? Number(creatorFeePercent) : 0,
        creatorParticipates,
      });
      router.replace(`/home/challenges/${id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not create challenge');
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '12px 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Link href="/home/challenges" style={{ color: '#555', fontSize: 20, lineHeight: 1 }}>←</Link>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#EFEFEF' }}>New Challenge</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="inp-wrap">
          <input
            style={{ flex: 1, background: 'transparent', padding: '10px 14px', fontSize: 13, color: '#EFEFEF', width: '100%' }}
            placeholder="Challenge goal (e.g. Go to the gym 20 times)"
            value={goal}
            onChange={e => setGoal(e.target.value)}
            maxLength={100}
          />
        </div>

        <div>
          <p style={{ fontSize: 9, color: '#555', letterSpacing: 1, marginBottom: 6 }}>TYPE</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['public', 'private'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={type === t ? 'chip chip-active' : 'chip'}
                style={{ flex: 1 }}
              >
                {t === 'public' ? '🌐 Public' : '🔒 Private'}
              </button>
            ))}
          </div>
        </div>

        <div className="inp-wrap">
          <span style={{ padding: '0 0 0 14px', fontSize: 13, color: '#555' }}>$</span>
          <input
            style={{ flex: 1, background: 'transparent', padding: '10px 8px', fontSize: 13, color: '#EFEFEF' }}
            placeholder="Bet amount (min $5)"
            value={betAmount}
            onChange={e => {
              const v = e.target.value.replace(/[^0-9.]/g, '');
              const d = v.indexOf('.');
              setBetAmount(d === -1 ? v : v.slice(0, d + 1) + v.slice(d + 1).replace(/\./g, ''));
            }}
            inputMode="decimal"
            type="text"
          />
        </div>

        <div>
          <p style={{ fontSize: 9, color: '#555', letterSpacing: 1, marginBottom: 6 }}>DURATION (DAYS)</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {['7', '14', '30', '60'].map(d => (
              <button
                key={d}
                onClick={() => setDurationDays(d)}
                className={durationDays === d ? 'chip chip-active' : 'chip'}
                style={{ flex: 1 }}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        <div>
          <p style={{ fontSize: 9, color: '#555', letterSpacing: 1, marginBottom: 6 }}>STARTS IN</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {['1', '3', '7'].map(d => (
              <button
                key={d}
                onClick={() => setStartsInDays(d)}
                className={startsInDays === d ? 'chip chip-active' : 'chip'}
                style={{ flex: 1 }}
              >
                {d === '1' ? 'Tomorrow' : `${d} days`}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px' }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#EFEFEF' }}>I&apos;m participating</p>
            <p style={{ fontSize: 10, color: '#333' }}>Your bet is also locked in</p>
          </div>
          <button
            onClick={() => setCreatorParticipates(v => !v)}
            style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: creatorParticipates ? '#39FF7A' : '#222', transition: 'background .15s', position: 'relative', border: 'none', cursor: 'pointer' }}
          >
            <div style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#0C0C0C', position: 'absolute', top: 3, left: creatorParticipates ? 23 : 3, transition: 'left .15s' }} />
          </button>
        </div>

        {type === 'public' && (
          <div>
            <p style={{ fontSize: 9, color: '#555', letterSpacing: 1, marginBottom: 6 }}>CREATOR FEE %</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {['0', '5', '10', '15'].map(f => (
                <button
                  key={f}
                  onClick={() => setCreatorFeePercent(f)}
                  className={creatorFeePercent === f ? 'chip chip-active' : 'chip'}
                  style={{ flex: 1 }}
                >
                  {f}%
                </button>
              ))}
            </div>
            <p style={{ fontSize: 9, color: '#333', marginTop: 6 }}>Taken from pot before winners paid out.</p>
          </div>
        )}

        {error && <p style={{ fontSize: 12, color: '#F87171', textAlign: 'center' }}>{error}</p>}

        <button
          className="btn-primary"
          onClick={handleCreate}
          disabled={!canCreate || loading}
          style={{ marginTop: 8 }}
        >
          {loading ? 'Creating…' : 'Create Challenge →'}
        </button>
      </div>
    </div>
  );
}
