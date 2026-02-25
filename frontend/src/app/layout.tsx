import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/shared/Header';

export const metadata: Metadata = {
  title: 'TalentAI — AI Resume Screening',
  description: 'Three-layer AI matches candidates to jobs with full explainability — semantic similarity, keyword overlap, and experience matching.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="noise-overlay">
        <Header />
        <main style={{ paddingTop: 64, minHeight: '100vh' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
