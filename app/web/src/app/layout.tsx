import type { ReactNode } from 'react';
import { Header } from '../components/header';

export const metadata = {
  title: 'Trip Expense Tracker',
  description: 'Track shared trip expenses and settle up.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
