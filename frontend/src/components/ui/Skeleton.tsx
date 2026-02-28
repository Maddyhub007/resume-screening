'use client';

// Reusable skeleton components. Use these on EVERY loading state — no blank screens.

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ style }: SkeletonProps) {
  return (
    <div style={{
      background: 'linear-gradient(90deg, var(--surface2, #141420) 25%, var(--surface3, #1a1a28) 50%, var(--surface2, #141420) 75%)',
      backgroundSize: '200% 100%',
      animation: 'skelAnim 1.5s ease-in-out infinite',
      borderRadius: 8,
      ...style,
    }} />
  );
}

export function CardSkeleton() {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '1.75rem' }}>
      <style>{`@keyframes skelAnim{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <Skeleton style={{ height: 20, width: '60%', marginBottom: 12 }} />
      <Skeleton style={{ height: 14, width: '100%', marginBottom: 8 }} />
      <Skeleton style={{ height: 14, width: '80%', marginBottom: 20 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <Skeleton style={{ height: 24, width: 70, borderRadius: 99 }} />
        <Skeleton style={{ height: 24, width: 70, borderRadius: 99 }} />
        <Skeleton style={{ height: 24, width: 70, borderRadius: 99 }} />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="tbl-wrap">
      <style>{`@keyframes skelAnim{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {[80, 160, 100, 100, 100, 100, 80].map((w, i) => (
              <th key={i} style={{ padding: '13px 18px' }}>
                <Skeleton style={{ height: 10, width: w }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '13px 18px' }}><Skeleton style={{ height: 28, width: 28, borderRadius: 8 }} /></td>
              <td style={{ padding: '13px 18px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Skeleton style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0 }} />
                  <div><Skeleton style={{ height: 12, width: 120, marginBottom: 5 }} /><Skeleton style={{ height: 10, width: 80 }} /></div>
                </div>
              </td>
              {[80, 60, 60, 80, 140, 60].map((w, j) => (
                <td key={j} style={{ padding: '13px 18px' }}><Skeleton style={{ height: 12, width: w }} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function JobCardSkeleton() {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '1.4rem' }}>
      <style>{`@keyframes skelAnim{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <Skeleton style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0 }} />
        <Skeleton style={{ height: 12, width: 80 }} />
      </div>
      <Skeleton style={{ height: 18, width: '75%', marginBottom: 8 }} />
      <Skeleton style={{ height: 12, width: '100%', marginBottom: 6 }} />
      <Skeleton style={{ height: 12, width: '85%', marginBottom: 14 }} />
      <div style={{ display: 'flex', gap: 5 }}>
        <Skeleton style={{ height: 22, width: 60, borderRadius: 99 }} />
        <Skeleton style={{ height: 22, width: 60, borderRadius: 99 }} />
        <Skeleton style={{ height: 22, width: 60, borderRadius: 99 }} />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.4rem' }}>
      <style>{`@keyframes skelAnim{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <Skeleton style={{ height: 10, width: 100, marginBottom: 16 }} />
      <Skeleton style={{ height: 36, width: 70 }} />
    </div>
  );
}

export function ScoreCardSkeleton() {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20, padding: '1.75rem' }}>
      <style>{`@keyframes skelAnim{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <Skeleton style={{ height: 14, width: 140, marginBottom: 20 }} />
      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', marginBottom: 20 }}>
        <Skeleton style={{ width: 110, height: 110, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <Skeleton style={{ height: 10, marginBottom: 16, borderRadius: 99 }} />
          <Skeleton style={{ height: 10, marginBottom: 16, borderRadius: 99 }} />
          <Skeleton style={{ height: 10, borderRadius: 99 }} />
        </div>
      </div>
    </div>
  );
}
