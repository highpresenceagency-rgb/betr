'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, Transaction, getMyWallet, getMyTransactions, depositFunds, requestWithdrawal } from '@/lib/api';

const CHIPS = [25, 50, 100, 250];

export default function WalletPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<Wallet>({ balance: 0, locked_balance: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [depositAmount, setDepositAmount] = useState(50);
  const [customDeposit, setCustomDeposit] = useState('');
  const [depositing, setDepositing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(false);

  useEffect(() => {
    Promise.all([getMyWallet(), getMyTransactions()])
      .then(([w, t]) => { setWallet(w); setTransactions(t); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const customNum = Number(customDeposit);
  const effectiveAmount = customDeposit && isFinite(customNum) ? customNum : depositAmount;

  const handleDeposit = async () => {
    if (!(effectiveAmount >= 5)) { setMsg('Minimum deposit is $5'); setMsgOk(false); return; }
    setDepositing(true);
    setMsg('');
    try {
      await depositFunds(effectiveAmount);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Deposit failed');
      setMsgOk(false);
      setDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    setWithdrawing(true);
    setMsg('');
    try {
      await requestWithdrawal(wallet.balance);
      setMsg('Withdrawal request submitted.');
      setMsgOk(true);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Withdrawal failed');
      setMsgOk(false);
    }
    setWithdrawing(false);
  };

  return (
    <div style={{ padding: '12px 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => router.back()} style={{ color: '#555', fontSize: 20, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>←</button>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#EFEFEF' }}>Wallet</h1>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '20px 16px', marginBottom: 16 }}>
        <p style={{ fontSize: 9, color: '#555', letterSpacing: 1.5, marginBottom: 6 }}>AVAILABLE BALANCE</p>
        <p style={{ fontSize: 36, fontWeight: 800, color: '#39FF7A', marginBottom: 4 }}>
          ${wallet.balance.toFixed(2)}
        </p>
        {wallet.locked_balance > 0 && (
          <p style={{ fontSize: 10, color: '#333' }}>${wallet.locked_balance.toFixed(2)} locked in challenges</p>
        )}
      </div>

      <span className="section-tag">DEPOSIT</span>
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {CHIPS.map(c => (
            <button
              key={c}
              onClick={() => { setDepositAmount(c); setCustomDeposit(''); }}
              className={depositAmount === c && !customDeposit ? 'chip chip-active' : 'chip'}
              style={{ flex: 1 }}
            >
              ${c}
            </button>
          ))}
        </div>

        <div className="inp-wrap" style={{ marginBottom: 12 }}>
          <span style={{ padding: '0 0 0 14px', fontSize: 22, fontWeight: 800, color: '#39FF7A' }}>$</span>
          <input
            style={{ flex: 1, background: 'transparent', padding: '8px 8px', fontSize: 22, fontWeight: 800, color: '#39FF7A', width: '100%' }}
            placeholder="0.00"
            value={customDeposit}
            onChange={e => {
              const v = e.target.value.replace(/[^0-9.]/g, '');
              const d = v.indexOf('.');
              setCustomDeposit(d === -1 ? v : v.slice(0, d + 1) + v.slice(d + 1).replace(/\./g, ''));
            }}
            inputMode="decimal"
            type="text"
          />
        </div>

        <button className="btn-primary" onClick={handleDeposit} disabled={depositing || !(effectiveAmount >= 5)}>
          {depositing ? 'Redirecting…' : `Deposit $${effectiveAmount.toFixed(2)} →`}
        </button>
      </div>

      {wallet.balance >= 10 && (
        <>
          <span className="section-tag">WITHDRAW</span>
          <div className="card" style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: '#333', marginBottom: 12 }}>Withdraw your available balance to your bank account.</p>
            <button className="btn-ghost" onClick={handleWithdraw} disabled={withdrawing}>
              {withdrawing ? 'Submitting…' : `Withdraw $${wallet.balance.toFixed(2)} →`}
            </button>
          </div>
        </>
      )}

      {msg && <p style={{ fontSize: 12, color: msgOk ? '#39FF7A' : '#F87171', textAlign: 'center', marginBottom: 14 }}>{msg}</p>}

      {!loading && transactions.length > 0 && (
        <>
          <span className="section-tag">HISTORY</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {transactions.map(t => {
              const isPositive = t.amount > 0;
              return (
                <div key={t.id} className="card" style={{ display: 'flex', alignItems: 'center', padding: '10px 14px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0' }}>{t.description}</p>
                    <p style={{ fontSize: 9, color: '#333' }}>{new Date(t.created_at).toLocaleDateString()}</p>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: isPositive ? '#39FF7A' : '#F87171' }}>
                    {isPositive ? '+' : ''}${Math.abs(t.amount).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
