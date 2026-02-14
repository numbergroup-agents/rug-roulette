import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { WalletProvider } from '@/components/WalletProvider';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Rug Roulette | 6 Slots. 5 Rugs. 1 Survivor.',
  description: 'Russian roulette but make it DeFi. Bet SOL on 1 of 6 slots. 5 get rugged. Survive and win the pot.',
  openGraph: {
    title: 'Rug Roulette',
    description: '6 Slots. 5 Rugs. 1 Survivor. Bet SOL and pray.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rug Roulette',
    description: '6 Slots. 5 Rugs. 1 Survivor.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="antialiased">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
