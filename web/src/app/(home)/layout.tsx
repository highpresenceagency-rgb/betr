'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import { supabase } from '@/lib/supabase';

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!session) router.replace('/');
        else setReady(true);
      })
      .catch(() => router.replace('/'));
  }, [router]);

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', backgroundColor: '#0C0C0C' }}>
        <span style={{ color: '#39FF7A', fontSize: 13 }}>Loading…</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', backgroundColor: '#0C0C0C', position: 'relative' }}>
      <main style={{ paddingBottom: 80 }}>{children}</main>
      <Nav />
    </div>
  );
}
