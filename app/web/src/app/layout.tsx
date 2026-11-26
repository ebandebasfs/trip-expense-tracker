import type { ReactNode } from 'react';
import { Geist } from 'next/font/google';
import { Header } from '../components/header';
import { cn } from '@/lib/utils';
import './globals.css';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata = {
  title: 'Trip Expense Tracker',
  description: 'Track shared trip expenses and settle up.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable)}>
      <body className="min-h-svh bg-background text-foreground antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
