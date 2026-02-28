'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store/appStore';
import { toInt, getScoreMeta } from '@/lib/utils/scores';
import ScoreRing from '@/components/ui/ScoreRing';
import ScoreBar from '@/components/ui/ScoreBar';
import ExplainPanel from '@/components/ui/ExplainPanel';
import EmptyState from '@/components/ui/EmptyState';

export default function AnalysisPage() {
  const router  = useRouter();
  const c       = useAppStore(s => s.selectedCandidate);
  const [notes, setNotes] = useState('');

  if (!c) return (
    <div style={{ padding: '2.5rem', maxWidth: 1080 }}>
      <EmptyState icon="🔍" title="No candidate selected" message="Go to Rankings and click a candidate to analyse."
        cta={{ label: '← Back to Rankings', href: '/recruiter/candidates' }} />
    </div>
  );

  const meta = getScoreMeta(c.scores.final_score);

  return (
    <div style={{ padding: '2.5rem', maxWidth: 1080 }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>
          <span style={{ color: 'var(--text-m)' }}>Recruiter</span><span style={{ color: 'var(--border-hi)' }}>›</span><span style={{ color: 'var(--tl)' }}>Analysis</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.75rem' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: 6 }}>Analysis <span className="grad-text">Panel</span></h1>
            <p style={{ color: 'var(--text2)', fontSize: '.9rem' }}>Deep-dive into this candidate's score and AI reasoning</p>
          </div>
          <button onClick={() => router.push('/recruiter/candidates')} className="btn-secondary" style={{ padding: '9px 20px', borderRadius: 10, fontSize: '.875rem' }}>← Rankings</button>
        </div>

        {/* Header banner */}
        <motion.div initial={{ opacity: 0, scale: .98 }} animate={{ opacity: 1, scale: 1 }}
          style={{ display: 'flex', gap: 14, alignItems: 'center', background: 'linear-gradient(135deg,rgba(124,106,247,.08),rgba(45,212,191,.04))', border: '1px solid var(--border-hi)', borderRadius: 20, padding: '1.5rem', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,var(--violet),var(--teal))', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '1.2rem', color: '#fff', flexShrink: 0, boxShadow: '0 4px 16px rgba(124,106,247,.35)' }}>
            {c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '1.1rem', marginBottom: 3 }}>{c.name}</div>
            <div style={{ fontSize: '.78rem', color: 'var(--text-m)' }}>{c.email}</div>
          </div>
          <div style={{ marginLeft: 10 }}>
            <span style={{ background: 'var(--vd)', border: '1px solid rgba(124,106,247,.2)', color: 'var(--violet)', padding: '3px 10px', borderRadius: 99, fontSize: '.72rem', fontWeight: 800 }}>Rank #{c.rank}</span>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <div style={{ fontSize: '.68rem', color: 'var(--text-m)', marginBottom: 2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Final Score</div>
            <div style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '1.5rem', color: meta.cssVar }}>{toInt(c.scores.final_score)}%</div>
          </div>
          <span style={{ background: `${meta.cssVar}18`, border: `1px solid ${meta.cssVar}40`, color: meta.cssVar, padding: '5px 14px', borderRadius: 99, fontSize: '.78rem', fontWeight: 800 }}>{meta.emoji} {meta.label}</span>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <div className="sec-line">Score Breakdown</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '1.5rem' }}>
                <ScoreRing score={c.scores.final_score} size={110} />
                <div style={{ flex: 1 }}>
                  <ScoreBar label="Semantic"   value={toInt(c.scores.semantic_score)}   variant="violet" sublabel="MiniLM" />
                  <ScoreBar label="Keyword"    value={toInt(c.scores.keyword_score)}    variant="teal"   sublabel="TF-IDF" />
                  <ScoreBar label="Experience" value={toInt(c.scores.experience_score)} variant="amber"  sublabel="Years" />
                </div>
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px', fontSize: '.78rem', color: 'var(--text-m)', lineHeight: 1.7 }}>
                <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>Formula</strong>
                (Semantic × 0.5) + (Keyword × 0.3) + (Experience × 0.2) = <strong style={{ color: 'var(--teal)' }}>{toInt(c.scores.final_score)}%</strong>
              </div>
            </div>

            <div className="card">
              <div className="sec-line">Skill Breakdown</div>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '.65rem', fontWeight: 800, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>✓ Matched ({c.explainability.matched_skills.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {c.explainability.matched_skills.map(s => <span key={s} className="chip chip-green">{s}</span>)}
                  {c.explainability.matched_skills.length === 0 && <span style={{ fontSize: '.78rem', color: 'var(--text-d)' }}>None</span>}
                </div>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '.65rem', fontWeight: 800, color: 'var(--rose)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>✗ Missing ({c.explainability.missing_skills.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {c.explainability.missing_skills.map(s => <span key={s} className="chip chip-red">{s}</span>)}
                  {c.explainability.missing_skills.length === 0 && <span style={{ fontSize: '.78rem', color: 'var(--teal)', fontWeight: 700 }}>All matched!</span>}
                </div>
              </div>
              {c.explainability.extra_skills?.length > 0 && (
                <div>
                  <div style={{ fontSize: '.65rem', fontWeight: 800, color: 'var(--text-m)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>+ Bonus</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {c.explainability.extra_skills.map(s => <span key={s} className="chip chip-grey">{s}</span>)}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <ExplainPanel ex={c.explainability} />

            <div className="card">
              <div className="sec-line">Actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.25rem' }}>
                {[
                  { label: '📅 Schedule Interview', variant: 'btn-primary', msg: `Interview invite sent to ${c.email}` },
                  { label: '📧 Send Invite Email',  variant: 'btn-secondary', msg: `Application update sent to ${c.email}` },
                  { label: '✗ Reject Candidate',    variant: 'btn-danger',   msg: `${c.name} removed from shortlist` },
                ].map(action => (
                  <button key={action.label} className={action.variant}
                    onClick={() => toast.success(action.label.replace(/^[^\w]+/, ''), { description: action.msg })}
                    style={{ padding: '10px', borderRadius: 10 }}>{action.label}</button>
                ))}
              </div>
              <div className="divider" />
              <div className="sec-line">Recruiter Notes</div>
              <textarea className="field-input" style={{ resize: 'vertical', minHeight: 80, lineHeight: 1.6 }}
                placeholder="Add private notes…" value={notes} onChange={e => setNotes(e.target.value)} />
              <button onClick={() => toast.success('Notes saved')}
                style={{ marginTop: 8, background: 'var(--td)', border: '1px solid rgba(45,212,191,.25)', color: 'var(--teal)', padding: '7px 16px', borderRadius: 8, fontSize: '.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-b)' }}>
                Save Notes
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
