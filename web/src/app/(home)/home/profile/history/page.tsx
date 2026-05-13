'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Transaction, getMyTransactions } from '@/lib/api';

const TYPE_LABEL: Record<string, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  challenge_join: 'Challenge Entry',
  win: 'Winnings',
  refund: 'Refund',
};

export default function HistoryPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyTransactions()
      .then(t => setTransactions(t))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const won = transactions.filter(t => t.type === 'win').length;
  const entered = transactions.filter(t => t.type === 'challenge_join').length;

  return (
    <div style={{ padding: '12px 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => router.back()} style={{ color: '#555', fontSize: 20, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>←</button>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#EFEFEF' }}>Challenge History</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}><span style={{ color: '#39FF7A' }}>Loading…</span></div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {[
              [String(won), 'Won'],
              [String(entered), 'Entered'],
              [String(transactions.length), 'All Tx'],
            ].map(([v, l]) => (
              <div key={l} className="stat-box" style={{ flex: 1 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#39FF7A' }}>{v}</span>
                <span style={{ fontSize: 8, color: '#333', marginTop: 2 }}>{l}</span>
              </div>
            ))}
          </div>

          <span className="section-tag">TRANSACTIONS</span>

          {transactions.length === 0 ? (
            <p style={{ color: '#333', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No transactions yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {transactions.map(t => {
                const isPositive = t.amount > 0;
                return (
                  <div key={t.id} className="card" style={{ display: 'flex', alignItems: 'center', padding: '10px 14px' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#111', border: '1px solid #1E1E1E', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10, flexShrink: 0 }}>
                      <span style={{ fontSize: 14 }}>
                        {t.type === 'deposit' ? '↓' : t.type === 'withdrawal' ? '↑' : t.type === 'win' ? '🏆' : t.type === 'refund' ? '↩' : '🎯'}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0' }}>{t.description || TYPE_LABEL[t.type]}</p>
                      <p style={{ fontSize: 9, color: '#333' }}>{new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: isPositive ? '#39FF7A' : '#F87171' }}>
                      {isPositive ? '+' : ''}${Math.abs(t.amount).toFixed(2)}
                    </span>
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
