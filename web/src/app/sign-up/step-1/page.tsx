'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/Input';
import { PrimaryButton } from '@/components/Button';
import Logo from '@/components/Logo';
import BackButton from '@/components/BackButton';
import ProgressBar from '@/components/ProgressBar';
import { signUpStore } from '@/lib/signUpStore';

export default function SignUpStep1() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const canContinue = firstName.trim().length > 0 && username.trim().length > 0;

  return (
    <div style={{ minHeight: '100dvh', padding: '12px 20px 40px', backgroundColor: '#0C0C0C', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <BackButton href="/" />
      <Logo size="md" />
      <p style={{ fontSize: 9, color: '#333333', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4, marginBottom: 4 }}>Create account · 1 of 3</p>
      <ProgressBar step={1} />

      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#EFEFEF', marginBottom: 4 }}>What's your name?</h1>
        <p style={{ fontSize: 12, color: '#333333', lineHeight: '18px' }}>This is how friends will find you.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        <Input label="First name" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jake" autoCapitalize="words" />
        <Input label="Last name" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Rodriguez" autoCapitalize="words" />
        <Input
          label="Username"
          value={username}
          onChange={e => setUsername(e.target.value.replace(/[^a-z0-9_]/gi, '').toLowerCase())}
          placeholder="jake_r"
          autoCapitalize="none"
          autoCorrect="off"
        />
      </div>

      <PrimaryButton
        label="Continue →"
        disabled={!canContinue}
        onClick={() => {
          signUpStore.firstName = firstName.trim();
          signUpStore.lastName = lastName.trim();
          signUpStore.username = username.trim();
          router.push('/sign-up/step-2');
        }}
      />
    </div>
  );
}
