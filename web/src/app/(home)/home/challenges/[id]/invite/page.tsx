'use client';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

export default function InvitePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const inviteLink = typeof window !== 'undefined'
    ? `${window.location.origin}/home/challenges/${id}`
    : `/home/challenges/${id}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const code = id.slice(0, 6).toUpperCase();

  return (
    <div style={{ padding: '12px 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={() => router.back()} style={{ color: '#555', fontSize: 20, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>←</button>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#EFEFEF' }}>Invite Friends</h1>
      </div>

      <div className="card" style={{ textAlign: 'center', padding: '24px 16px', marginBottom: 16 }}>
        <p style={{ fontSize: 9, color: '#555', letterSpacing: 1.5, marginBottom: 14 }}>CHALLENGE CODE</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
          {code.split('').map((ch, i) => (
            <div key={i} style={{ width: 36, height: 44, borderRadius: 8, backgroundColor: '#111', border: '1.5px solid #2A2A2A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#39FF7A', letterSpacing: 0 }}>{ch}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '7px 7px 7px 7px 7px 7px 7px', gap: 3, justifyContent: 'center', marginBottom: 20 }}>
          {Array.from({ length: 7 * 7 }).map((_, i) => {
            const row = Math.floor(i / 7);
            const col = i % 7;
            const isGreen = (row + col) % 3 === 0 || (row * col) % 5 === 0;
            return (
              <div key={i} style={{ width: 7, height: 7, borderRadius: 1, backgroundColor: isGreen ? '#39FF7A' : '#111', opacity: isGreen ? 0.7 : 1 }} />
            );
          })}
        </div>

        <p style={{ fontSize: 10, color: '#333' }}>Share this code or link with friends</p>
      </div>

      <div className="inp-wrap" style={{ marginBottom: 10 }}>
        <input
          readOnly
          value={inviteLink}
          style={{ flex: 1, background: 'transparent', padding: '10px 14px', fontSize: 11, color: '#555', width: '100%' }}
        />
      </div>

      <button className="btn-primary" onClick={copyLink} style={{ marginBottom: 8 }}>
        {copied ? '✓ Copied!' : 'Copy Link'}
      </button>

      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <button
          className="btn-ghost"
          onClick={() => navigator.share({ title: 'Join my challenge', url: inviteLink }).catch(() => {})}
        >
          Share
        </button>
      )}
    </div>
  );
}
