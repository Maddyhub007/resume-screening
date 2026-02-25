'use client';
// src/components/ui/ScoreBar.tsx
import { useEffect, useRef } from 'react';

type Variant = 'violet' | 'teal' | 'amber' | 'rose';

const GRADIENTS: Record<Variant, string> = {
  violet: 'linear-gradient(90deg, #7c6af7, #a08fff)',
  teal:   'linear-gradient(90deg, #2dd4bf, #5eead4)',
  amber:  'linear-gradient(90deg, #f59e0b, #fcd34d)',
  rose:   'linear-gradient(90deg, #f43f5e, #fb7185)',
};

const DOTS: Record<Variant, string> = {
  violet: 'var(--violet)',
  teal:   'var(--teal)',
  amber:  'var(--amber)',
  rose:   'var(--rose)',
};

interface ScoreBarProps {
  label: string;
  value: number;         // 0–100 integer
  variant?: Variant;
  sublabel?: string;
  animate?: boolean;
}

export default function ScoreBar({ label, value, variant = 'violet', sublabel, animate = true }: ScoreBarProps) {
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animate || !fillRef.current) return;
    fillRef.current.style.width = '0%';
    const id = setTimeout(() => { if (fillRef.current) fillRef.current.style.width = `${value}%`; }, 80);
    return () => clearTimeout(id);
  }, [value, animate]);

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: DOTS[variant], display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-d)', fontWeight: 700, fontSize: '.82rem' }}>{label}</span>
          {sublabel && <span style={{ fontSize: '.68rem', color: 'var(--text-d)', marginLeft: 4 }}>{sublabel}</span>}
        </div>
        <span style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '.85rem', color: DOTS[variant] }}>{value}%</span>
      </div>
      <div className="score-track">
        <div
          ref={fillRef}
          className="score-fill shimmer"
          style={{
            width: animate ? '0%' : `${value}%`,
            background: GRADIENTS[variant],
            transition: animate ? 'width 1.1s cubic-bezier(.34,1.2,.64,1)' : 'none',
          }}
        />
      </div>
    </div>
  );
}
