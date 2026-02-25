export default function Spinner({ message = 'Loading…', sub }: { message?: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', gap: '1.5rem' }}>
      <div style={{ position: 'relative', width: 52, height: 52 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--violet)', animation: 'spin .8s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 9, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--teal)', animation: 'spin 1.3s linear infinite reverse' }} />
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-d)', fontWeight: 700, fontSize: '.95rem', marginBottom: 4 }}>{message}</div>
        {sub && <div style={{ fontSize: '.78rem', color: 'var(--text-d)' }}>{sub}</div>}
      </div>
    </div>
  );
}
