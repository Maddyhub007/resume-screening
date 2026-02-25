'use client';
// src/components/ui/ScoreRing.tsx
// score: 0.0–1.0 float (multiply by 100 internally)
import { useEffect, useRef } from 'react';

function style(score: number) {
  const p = score * 100;
  if (p >= 80) return { color: '#2dd4bf', label: 'Excellent', grad: '#2dd4bf,#5eead4' };
  if (p >= 65) return { color: '#7c6af7', label: 'Strong',    grad: '#7c6af7,#a08fff' };
  if (p >= 50) return { color: '#f59e0b', label: 'Moderate',  grad: '#f59e0b,#fcd34d' };
  return             { color: '#f43f5e', label: 'Weak',      grad: '#f43f5e,#fb7185' };
}

interface ScoreRingProps {
  score: number;   // 0.0–1.0
  size?: number;
  stroke?: number;
  showLabel?: boolean;
}

export default function ScoreRing({ score, size = 120, stroke = 9, showLabel = true }: ScoreRingProps) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const off  = circ - (score * circ);
  const s    = style(score);
  const ref  = useRef<SVGCircleElement>(null);
  const gid  = `rg-${size}`;

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.strokeDashoffset = String(circ);
    const id = setTimeout(() => { if (ref.current) ref.current.style.strokeDashoffset = String(off); }, 100);
    return () => clearTimeout(id);
  }, [score, circ, off]);

  const pct = Math.round(score * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', background: `radial-gradient(circle, ${s.color}18 0%, transparent 70%)` }} />
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="0%">
              {s.grad.split(',').map((c, i) => <stop key={i} offset={i === 0 ? '0%' : '100%'} stopColor={c} />)}
            </linearGradient>
          </defs>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface3)" strokeWidth={stroke} />
          <circle ref={ref} cx={size/2} cy={size/2} r={r} fill="none"
            stroke={`url(#${gid})`} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ}
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.34,1.2,.64,1)', filter: `drop-shadow(0 0 4px ${s.color}66)` }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: `${size * 0.21}px`, color: s.color }}>
          {pct}%
        </div>
      </div>
      {showLabel && <span style={{ fontSize: '.7rem', color: s.color, fontWeight: 700 }}>{s.label}</span>}
    </div>
  );
}
