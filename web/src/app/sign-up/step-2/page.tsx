'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/Input';
import { PrimaryButton } from '@/components/Button';
import Logo from '@/components/Logo';
import BackButton from '@/components/BackButton';
import ProgressBar from '@/components/ProgressBar';
import { signUpStore } from '@/lib/signUpStore';

export default function SignUpStep2() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);

  const emailValid = email.includes('@') && email.includes('.');
  const passwordValid = password.length >= 8;
  const passwordsMatch = password === confirm;
  const canContinue = emailValid && passwordValid && passwordsMatch;

  return (
    <div style={{ minHeight: '100dvh', padding: '12px 20px 40px', backgroundColor: '#0C0C0C', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <BackButton href="/sign-up/step-1" />
      <Logo size="md" />
      <p style={{ fontSize: 9, color: '#333333', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4, marginBottom: 4 }}>Create account · 2 of 3</p>
      <ProgressBar step={2} />

      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#EFEFEF', marginBottom: 4 }}>Create your login</h1>
        <p style={{ fontSize: 12, color: '#333333', lineHeight: '18px' }}>You'll use this to sign in to Bettrr.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="jake@example.com"
          autoComplete="email"
          rightElement={emailValid ? <span style={{ color: '#39FF7A', fontWeight: 700, fontSize: 13 }}>✓</span> : null}
        />
        <Input
          label="Password"
          type={showPass ? 'text' : 'password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Min. 8 characters"
          autoComplete="new-password"
          rightElement={
            <button onClick={() => setShowPass(v => !v)} style={{ fontSize: 11, fontWeight: 600, color: '#39FF7A' }}>
              {showPass ? 'Hide' : 'Show'}
            </button>
          }
        />
        <Input
          label="Confirm password"
          type={showPass ? 'text' : 'password'}
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Re-enter password"
          autoComplete="new-password"
          rightElement={
            confirm.length > 0
              ? <span style={{ fontSize: 13, fontWeight: 700, color: passwordsMatch ? '#39FF7A' : '#F87171' }}>{passwordsMatch ? '✓' : '✗'}</span>
              : null
          }
        />
      </div>

      <PrimaryButton
        label="Continue →"
        disabled={!canContinue}
        onClick={() => {
          signUpStore.email = email.trim();
          signUpStore.password = password;
          router.push('/sign-up/step-3');
        }}
      />
    </div>
  );
}
