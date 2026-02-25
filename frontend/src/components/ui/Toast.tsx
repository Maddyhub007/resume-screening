'use client';
import { useEffect } from 'react';

interface ToastProps {
  icon: string;
  title: string;
  message: string;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ icon, title, message, onClose, duration = 3500 }: ToastProps) {
  useEffect(() => {
    const id = setTimeout(onClose, duration);
    return () => clearTimeout(id);
  }, [onClose, duration]);

  return (
    <div className="toast">
      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--surface3)', display: 'grid', placeItems: 'center', fontSize: '1.3rem', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-d)', fontWeight: 700, fontSize: '.875rem', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: '.78rem', color: 'var(--text-m)' }}>{message}</div>
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-d)', cursor: 'pointer', fontSize: '1rem', flexShrink: 0 }}>✕</button>
    </div>
  );
}
