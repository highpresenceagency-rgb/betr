'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Input from '@/components/Input';
import { PrimaryButton } from '@/components/Button';
import Logo from '@/components/Logo';
import { supabase } from '@/lib/supabase';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) return;
    setLoading(true);
    setMsg('');
    setMsgOk(false);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) { setMsg(error.message); return; }
    router.replace('/home');
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) { setMsg('Enter your email first'); setMsgOk(false); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setMsgOk(!error);
    setMsg(error ? error.message : `Reset link sent to ${email.trim()}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: '40px 24px', backgroundColor: '#0C0C0C', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <p style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6, color: '#2A2A2A' }}>Welcome back</p>
        <Logo size="lg" />
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="jake@bettrr.app"
          autoComplete="email"
        />
        <Input
          label="Password"
          type={showPass ? 'text' : 'password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          onKeyDown={e => e.key === 'Enter' && !loading && handleSignIn()}
          rightElement={
            <button onClick={() => setShowPass(v => !v)} style={{ fontSize: 11, fontWeight: 600, color: '#39FF7A' }}>
              {showPass ? 'Hide' : 'Show'}
            </button>
          }
        />
      </div>

      {msg && <p style={{ fontSize: 12, color: msgOk ? '#39FF7A' : '#F87171', marginBottom: 12, textAlign: 'center' }}>{msg}</p>}

      <div style={{ width: '100%' }}>
        <PrimaryButton label="Sign in" onClick={handleSignIn} loading={loading} />
      </div>

      <button onClick={handleForgotPassword} style={{ padding: '14px 0', fontSize: 12, color: '#333333' }}>
        Forgot password?
      </button>

      <p style={{ fontSize: 12, color: '#333333', marginTop: 20 }}>
        Don't have an account?{' '}
        <Link href="/sign-up/step-1" style={{ color: '#39FF7A', fontWeight: 700 }}>Get started</Link>
      </p>
    </div>
  );
}
