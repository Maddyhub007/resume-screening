// src/lib/utils/scores.ts
// Single source of truth for score colours. Import this everywhere.

export type ScoreTier = 'excellent' | 'good' | 'fair' | 'weak';

export interface ScoreMeta {
  tier: ScoreTier;
  label: string;
  emoji: string;
  cssVar: string;        // for inline styles
  tailwind: string;      // for Tailwind className
  bgTailwind: string;
  borderTailwind: string;
}

export function getScoreMeta(score: number): ScoreMeta {
  if (score >= 0.8)  return { tier: 'excellent', label: 'Excellent Match', emoji: '🟢', cssVar: '#10b981', tailwind: 'text-emerald-400',  bgTailwind: 'bg-emerald-500/10',  borderTailwind: 'border-emerald-500/25' };
  if (score >= 0.65) return { tier: 'good',      label: 'Strong Match',    emoji: '🔵', cssVar: '#3b82f6', tailwind: 'text-blue-400',     bgTailwind: 'bg-blue-500/10',     borderTailwind: 'border-blue-500/25'    };
  if (score >= 0.5)  return { tier: 'fair',      label: 'Moderate Match',  emoji: '🟡', cssVar: '#f59e0b', tailwind: 'text-amber-400',    bgTailwind: 'bg-amber-500/10',    borderTailwind: 'border-amber-500/25'   };
  return               { tier: 'weak',      label: 'Weak Match',      emoji: '🔴', cssVar: '#f43f5e', tailwind: 'text-rose-400',     bgTailwind: 'bg-rose-500/10',     borderTailwind: 'border-rose-500/25'    };
}

/** 0.0–1.0 → 0–100 integer */
export const toInt = (s: number) => Math.round(s * 100);

/** 0.0–1.0 → "74%" string */
export const toPct = (s: number) => `${toInt(s)}%`;

export function getPriorityMeta(p: 'high' | 'medium' | 'low') {
  if (p === 'high')   return { color: '#f43f5e', bg: 'rgba(244,63,94,.1)',  border: 'rgba(244,63,94,.25)'  };
  if (p === 'medium') return { color: '#f59e0b', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.25)' };
  return                     { color: '#10b981', bg: 'rgba(16,185,129,.1)', border: 'rgba(16,185,129,.25)' };
}

export function validateResumeFile(file: File): string | null {
  const ok = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!ok.includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.docx'))
    return 'Only .pdf or .docx files are accepted.';
  if (file.size > 5 * 1024 * 1024) return 'File must be under 5 MB.';
  return null;
}

export function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(1)} MB`;
}
