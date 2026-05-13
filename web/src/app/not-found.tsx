import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#0C0C0C', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <p style={{ fontSize: 48, fontWeight: 900, color: '#39FF7A', lineHeight: 1, marginBottom: 12 }}>404</p>
      <p style={{ fontSize: 16, fontWeight: 700, color: '#EFEFEF', marginBottom: 8 }}>Page not found</p>
      <p style={{ fontSize: 12, color: '#555', marginBottom: 32 }}>This page doesn't exist or was moved.</p>
      <Link href="/" style={{ padding: '12px 28px', borderRadius: 10, backgroundColor: '#39FF7A', color: '#0C0C0C', fontSize: 13, fontWeight: 800 }}>
        Go home
      </Link>
    </div>
  );
}
