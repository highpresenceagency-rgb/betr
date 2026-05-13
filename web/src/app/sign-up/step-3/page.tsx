'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PrimaryButton } from '@/components/Button';
import Logo from '@/components/Logo';
import BackButton from '@/components/BackButton';
import ProgressBar from '@/components/ProgressBar';
import { signUpStore } from '@/lib/signUpStore';
import { supabase } from '@/lib/supabase';

export default function SignUpStep3() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(false);

  const { firstName, lastName, username, email } = signUpStore;

  useEffect(() => {
    if (!firstName || !username || !email) {
      router.replace('/sign-up/step-1');
    }
  }, [firstName, username, email, router]);

  if (!firstName || !username || !email) return null;

  const displayName = lastName ? `${firstName} ${lastName}` : firstName;

  const handleCreate = async () => {
    setLoading(true);
    const { password } = signUpStore;
    const initials = ((firstName[0] ?? '') + (lastName[0] ?? firstName[1] ?? '')).toUpperCase();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: displayName, username, initials } },
    });

    setLoading(false);
    signUpStore.password = '';

    if (error) {
      setMsgOk(false);
      setMsg(error.message.includes('username')
        ? 'That username is already taken. Go back and choose a different one.'
        : error.message);
      return;
    }

    if (!data.session) {
      setMsgOk(true);
      setMsg(`Check your email — a confirmation link has been sent to ${email}.`);
      return;
    }

    signUpStore.email = '';
    router.replace('/home');
  };

  const rows = [['NAME', displayName], ['USERNAME', username], ['EMAIL', email]];

  return (
    <div style={{ minHeight: '100dvh', padding: '12px 20px 40px', backgroundColor: '#0C0C0C', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <BackButton href="/sign-up/step-2" />
      <Logo size="md" />
      <p style={{ fontSize: 9, color: '#333333', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4, marginBottom: 4 }}>Create account · 3 of 3</p>
      <ProgressBar step={3} />

      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#EFEFEF', marginBottom: 4 }}>You're all set</h1>
        <p style={{ fontSize: 12, color: '#333333', lineHeight: '18px' }}>Review your details before creating your account.</p>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        {rows.map(([label, val], i) => (
          <div key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
              <span style={{ fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: '#3A3A3A' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#D0D0D0' }}>{val}</span>
            </div>
            {i < rows.length - 1 && <div style={{ height: 1, backgroundColor: '#1E1E1E' }} />}
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: '#0D0D0D', borderRadius: 10, padding: 14, marginBottom: 24, border: '1px solid #1A1A1A' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#3A3A3A', marginBottom: 6 }}>💳  Add your bank after sign up</p>
        <p style={{ fontSize: 10, color: '#252525', lineHeight: '15px' }}>Connect a bank or debit card from the Wallet tab to deposit funds and join challenges.</p>
      </div>

      {msg && <p style={{ fontSize: 12, color: msgOk ? '#39FF7A' : '#F87171', marginBottom: 12, textAlign: 'center', lineHeight: '18px' }}>{msg}</p>}

      <div style={{ flex: 1 }} />
      <PrimaryButton label="Create account →" onClick={handleCreate} loading={loading} />
    </div>
  );
}
