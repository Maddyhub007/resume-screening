import Sidebar from '@/components/shared/Sidebar';

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
      <Sidebar role="candidate" />
      <main style={{ flex: 1, overflowX: 'hidden', minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
