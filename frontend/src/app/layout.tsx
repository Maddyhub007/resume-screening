import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/shared/Header';
import Providers from '@/lib/providers';

export const metadata: Metadata = {
  title: 'TalentAI — AI Resume Screening',
  description: 'AI-powered resume screening and job recommendation with semantic matching',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header />
          <div style={{ paddingTop: '64px', minHeight: '100vh' }}>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
