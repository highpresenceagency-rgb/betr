import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bettrr',
  description: 'Bet on yourself',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
