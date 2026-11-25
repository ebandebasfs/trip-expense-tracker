import type { ReactNode } from 'react';

export const metadata = {
  title: 'Trip Expense Tracker',
  description: 'Track shared trip expenses and settle up.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
