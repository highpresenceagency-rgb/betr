'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DepositSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => router.replace('/home/wallet'), 4000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#0C0C0C', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 32, border: '2px solid #39FF7A', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 28 }}>✓</span>
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#39FF7A', marginBottom: 8 }}>Deposit successful!</h1>
      <p style={{ fontSize: 13, color: '#555', lineHeight: '18px', marginBottom: 24 }}>
        Your funds will appear in your wallet within a few minutes.
      </p>
      <Link href="/home/wallet" style={{ display: 'block', padding: '13px 32px', borderRadius: 10, backgroundColor: '#39FF7A', color: '#0C0C0C', fontSize: 13, fontWeight: 800 }}>
        Go to wallet →
      </Link>
      <p style={{ fontSize: 10, color: '#333', marginTop: 16 }}>Redirecting automatically…</p>
    </div>
  );
}
