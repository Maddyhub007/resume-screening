// src/lib/utils.ts

/** Convert 0.0-1.0 float to display percent string: 0.74 → "74%" */
export const toPct = (score: number) => `${Math.round(score * 100)}%`;

/** Convert 0.0-1.0 float to integer 0-100 */
export const toInt = (score: number) => Math.round(score * 100);

/** Score display guide from Integration Guide §6 */
export function getScoreLabel(score: number): {
  label: string;
  color: 'green' | 'yellow' | 'orange' | 'red';
  emoji: string;
  cssVar: string;
} {
  if (score >= 0.8)  return { label: 'Excellent Match', color: 'green',  emoji: '🟢', cssVar: 'var(--teal)' };
  if (score >= 0.65) return { label: 'Strong Match',    color: 'yellow', emoji: '🟡', cssVar: 'var(--violet)' };
  if (score >= 0.5)  return { label: 'Moderate Match',  color: 'orange', emoji: '🟠', cssVar: 'var(--amber)' };
  return               { label: 'Weak Match',           color: 'red',    emoji: '🔴', cssVar: 'var(--rose)' };
}

/** Priority colour for upskill suggestions */
export function getPriorityColor(priority: 'high' | 'medium' | 'low') {
  if (priority === 'high')   return { bg: 'var(--rose-dim)',   border: 'rgba(244,63,94,0.25)',   text: 'var(--rose)'  };
  if (priority === 'medium') return { bg: 'var(--amber-dim)',  border: 'rgba(245,158,11,0.25)',  text: 'var(--amber)' };
  return                            { bg: 'var(--teal-dim)',   border: 'rgba(45,212,191,0.25)',  text: 'var(--teal)'  };
}

/** Format bytes to human string */
export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Validate a resume file before upload */
export function validateResumeFile(file: File): string | null {
  const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const ext = file.name.toLowerCase();
  if (!allowed.includes(file.type) && !ext.endsWith('.pdf') && !ext.endsWith('.docx')) {
    return 'Only .pdf or .docx files are accepted.';
  }
  if (file.size > 5 * 1024 * 1024) return 'File must be under 5 MB.';
  return null;
}

/** Consistent error message extractor */
export function extractError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (e.response && typeof e.response === 'object') {
      const r = e.response as Record<string, unknown>;
      if (r.data && typeof r.data === 'object') {
        const d = r.data as Record<string, unknown>;
        if (typeof d.error === 'string') return d.error;
      }
      if (r.status === 0 || !r.status) return 'Cannot connect to server. Is the backend running?';
    }
    if (typeof e.message === 'string') return e.message;
  }
  return 'Something went wrong.';
}
