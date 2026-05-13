const sizes = { sm: 20, md: 28, lg: 42 };

export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const fs = sizes[size];
  return (
    <span style={{ fontSize: fs, fontWeight: 900, letterSpacing: -1, color: '#EFEFEF', lineHeight: 1.2 }}>
      Bett<span style={{ color: '#39FF7A' }}>rr</span>
    </span>
  );
}
