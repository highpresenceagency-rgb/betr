'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function SplashPage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => { if (session) router.replace('/home'); })
      .catch(() => {});
  }, [router]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: '0 32px', backgroundColor: '#060606', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 52, fontWeight: 900, letterSpacing: -2, color: '#EFEFEF', lineHeight: 1.1 }}>
          Bett<span style={{ color: '#39FF7A' }}>rr</span>
        </h1>
        <p style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginTop: 8, color: '#333333' }}>
          Bet on yourself
        </p>
      </div>

      <div style={{ width: 60, height: 1, backgroundColor: '#2A2A2A', marginBottom: 32 }} />

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        <Link href="/sign-up/step-1" className="btn-primary" style={{ textAlign: 'center' }}>
          Get started
        </Link>
        <Link href="/sign-in" className="btn-ghost" style={{ textAlign: 'center' }}>
          Sign in
        </Link>
      </div>

      <p style={{ fontSize: 9, textAlign: 'center', lineHeight: '16px', color: '#252525' }}>
        By continuing you agree to our<br />Terms of Service &amp; Privacy Policy
      </p>
    </div>
  );
}
