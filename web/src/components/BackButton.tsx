'use client';
import { useRouter } from 'next/navigation';

export default function BackButton({ href, label = '← Back' }: { href?: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => href ? router.push(href) : router.back()}
      style={{ color: '#39FF7A', fontSize: 13, fontWeight: 600, letterSpacing: 0.3, marginBottom: 12, display: 'block' }}
    >
      {label}
    </button>
  );
}
