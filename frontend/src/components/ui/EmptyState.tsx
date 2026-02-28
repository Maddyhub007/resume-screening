'use client';
import Link from 'next/link';

interface EmptyStateProps {
  icon?: string;
  title: string;
  message: string;
  cta?: { label: string; href: string };
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon = '📭', title, message, cta, action }: EmptyStateProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1.25rem', opacity: .25 }}>{icon}</div>
      <div style={{ fontFamily: 'var(--font-d)', fontWeight: 700, fontSize: '1.05rem', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: '.85rem', color: 'var(--text-m)', maxWidth: 300, lineHeight: 1.7, marginBottom: '1.75rem' }}>{message}</div>
      {cta && (
        <Link href={cta.href} className="btn-primary" style={{ padding: '10px 24px', borderRadius: 10, fontSize: '.875rem', display: 'inline-block' }}>
          {cta.label}
        </Link>
      )}
      {action && (
        <button onClick={action.onClick} className="btn-secondary" style={{ padding: '10px 24px', borderRadius: 10, fontSize: '.875rem' }}>
          {action.label}
        </button>
      )}
    </div>
  );
}
