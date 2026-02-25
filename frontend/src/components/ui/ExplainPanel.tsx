'use client';
import type { Explainability } from '@/types';

export default function ExplainPanel({ ex }: { ex: Explainability }) {
  return (
    <div className="card-violet" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Decorative glow */}
      <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle,rgba(124,106,247,.12) 0%,transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.2rem', flexWrap: 'wrap' }}>
        <div style={{ background: 'var(--vd)', border: '1px solid rgba(124,106,247,.22)', borderRadius: 8, padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.68rem', fontWeight: 800, color: 'var(--vl)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
          🤖 AI Explanation
        </div>
        <div style={{ background: 'var(--td)', border: '1px solid rgba(45,212,191,.22)', borderRadius: 99, padding: '3px 10px', fontSize: '.68rem', fontWeight: 800, color: 'var(--teal)' }}>
          {ex.skill_match_pct}% skill match
        </div>
      </div>

      <blockquote style={{ fontFamily: 'var(--font-d)', fontSize: '.9rem', fontWeight: 600, lineHeight: 1.7, paddingLeft: '1rem', borderLeft: '3px solid var(--violet)', marginBottom: '1.4rem', fontStyle: 'italic' }}>
        "{ex.summary}"
      </blockquote>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2rem', marginBottom: ex.extra_skills?.length ? '1.2rem' : 0 }}>
        {/* Matched */}
        <div>
          <div style={{ fontSize: '.65rem', fontWeight: 800, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>✓ Matched</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {ex.matched_skills.length > 0
              ? ex.matched_skills.map(s => <span key={s} className="chip chip-green">{s}</span>)
              : <span style={{ fontSize: '.78rem', color: 'var(--text-d)' }}>None</span>}
          </div>
        </div>
        {/* Missing */}
        <div>
          <div style={{ fontSize: '.65rem', fontWeight: 800, color: 'var(--rose)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>✗ Missing</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {ex.missing_skills.length > 0
              ? ex.missing_skills.map(s => <span key={s} className="chip chip-red">{s}</span>)
              : <span style={{ fontSize: '.78rem', color: 'var(--teal)', fontWeight: 700 }}>All skills matched!</span>}
          </div>
        </div>
      </div>

      {/* Extra / bonus skills */}
      {ex.extra_skills?.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '.65rem', fontWeight: 800, color: 'var(--text-m)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>+ Bonus Skills</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {ex.extra_skills.map(s => <span key={s} className="chip chip-grey">{s}</span>)}
          </div>
        </div>
      )}

      {/* Improvement tips */}
      {ex.improvement_tips?.length > 0 && (
        <div style={{ marginTop: '1.2rem' }}>
          <div style={{ fontSize: '.65rem', fontWeight: 800, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>💡 How to Improve</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ex.improvement_tips.map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
                <span style={{ fontSize: '.8rem', flexShrink: 0 }}>{tip.priority === 'high' ? '🔴' : tip.priority === 'medium' ? '🟡' : '🟢'}</span>
                <span style={{ fontSize: '.8rem', color: 'var(--text2)', lineHeight: 1.5 }}>{tip.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
