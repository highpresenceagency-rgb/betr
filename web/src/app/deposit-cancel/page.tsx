'use client';
import Link from 'next/link';

export default function DepositCancelPage() {
  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#0C0C0C', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 32, border: '1.5px solid #3A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 28 }}>✗</span>
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#EFEFEF', marginBottom: 8 }}>Deposit cancelled</h1>
      <p style={{ fontSize: 13, color: '#555', lineHeight: '18px', marginBottom: 24 }}>
        No funds were charged. You can try again whenever you&apos;re ready.
      </p>
      <Link href="/home/wallet" style={{ display: 'block', padding: '13px 32px', borderRadius: 10, backgroundColor: '#0D1F11', border: '1.5px solid #3A7A45', color: '#39FF7A', fontSize: 13, fontWeight: 800 }}>
        Back to wallet
      </Link>
    </div>
  );
}
