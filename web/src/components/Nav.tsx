'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Trophy, Users, Wallet, UserCircle } from 'lucide-react';

const tabs = [
  { href: '/home', label: 'Home', Icon: LayoutGrid },
  { href: '/home/challenges', label: 'Challenges', Icon: Trophy },
  { href: '/home/friends', label: 'Friends', Icon: Users },
  { href: '/home/wallet', label: 'Wallet', Icon: Wallet },
  { href: '/home/profile', label: 'Profile', Icon: UserCircle },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480,
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      height: 64, paddingBottom: 10, paddingTop: 6,
      backgroundColor: '#0E0E0E',
      borderTop: '1.5px solid #2A2A2A',
      zIndex: 50,
    }}>
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href || (href !== '/home' && pathname.startsWith(href));
        const color = active ? '#39FF7A' : '#555555';
        return (
          <Link key={href} href={href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 }}>
            <Icon size={22} color={color} />
            <span style={{ fontSize: 10, fontWeight: 600, color }}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
