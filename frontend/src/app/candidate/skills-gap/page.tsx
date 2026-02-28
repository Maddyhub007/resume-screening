'use client';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useSkillGap } from '@/lib/hooks/useQueries';
import { useAppStore } from '@/lib/store/appStore';
import { getPriorityMeta } from '@/lib/utils/scores';
import EmptyState from '@/components/ui/EmptyState';
import { CardSkeleton } from '@/components/ui/Skeleton';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export default function SkillGapPage() {
  const router = useRouter();
  const resumeId = useAppStore(s => s.resumeId);
  const { data, isLoading, error } = useSkillGap(resumeId);
  const gap = data?.data;

  return (
    <div style={{ padding: '2.5rem', maxWidth: 1080 }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>
          <span style={{ color: 'var(--text-m)' }}>Candidate</span><span style={{ color: 'var(--border-hi)' }}>›</span><span style={{ color: 'var(--vl)' }}>Skill Gap</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: 6 }}>Skill Gap <span className="grad-text">Analysis</span></h1>
        <p style={{ color: 'var(--text2)', fontSize: '.9rem', marginBottom: '1.5rem' }}>Your current skills vs what the market demands — with upskilling paths</p>

        {!resumeId && <div style={{ background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 12, padding: '1rem 1.2rem', marginBottom: '1.5rem', color: 'var(--amber)', fontSize: '.875rem' }}>⚠️ No resume. <button onClick={() => router.push('/candidate/upload')} style={{ background: 'none', border: 'none', color: 'var(--violet)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', fontSize: '.875rem' }}>Upload first →</button></div>}

        {isLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {[0,1,2].map(i => <CardSkeleton key={i} />)}
          </div>
        )}

        {error && <div style={{ background: 'var(--rose-dim)', border: '1px solid rgba(244,63,94,.25)', borderRadius: 12, padding: '1rem', color: 'var(--rose)', fontSize: '.875rem' }}>Failed to load skill gap analysis.</div>}

        {!isLoading && !error && resumeId && !gap && <EmptyState icon="📊" title="No data yet" message="Upload a resume and post some jobs first to see skill gap analysis." />}

        {gap && (
          <div>
            {/* Skills overview */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div className="card">
                <div className="sec-line">✅ Your Current Skills ({gap.current_skills.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {gap.current_skills.map(s => <span key={s} className="chip chip-blue">{s}</span>)}
                  {gap.current_skills.length === 0 && <span style={{ fontSize: '.8rem', color: 'var(--text-d)' }}>No skills found</span>}
                </div>
              </div>
              <div className="card">
                <div className="sec-line">⚠️ Market Gaps ({gap.missing_skills.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {gap.missing_skills.map(s => <span key={s} className="chip chip-red">✗{s}</span>)}
                  {gap.missing_skills.length === 0 && <span style={{ fontSize: '.875rem', color: 'var(--teal)', fontWeight: 700 }}>🎉 No significant gaps!</span>}
                </div>
              </div>
            </div>

            {/* 3-column skill comparison bar */}
            {gap.current_skills.length > 0 && gap.missing_skills.length > 0 && (
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="sec-line">Skill Coverage</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '.8rem', color: 'var(--text-m)', width: 90 }}>You have</span>
                  <div style={{ flex: 1, height: 10, background: 'var(--surface3)', borderRadius: 99, overflow: 'hidden' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round(gap.current_skills.length / (gap.current_skills.length + gap.missing_skills.length) * 100)}%` }} transition={{ duration: 1.2, ease: [0.34,1.2,0.64,1] }}
                      style={{ height: '100%', background: 'linear-gradient(90deg,var(--teal),#5eead4)', borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: '.8rem', fontFamily: 'var(--font-d)', fontWeight: 800, color: 'var(--teal)', width: 36, textAlign: 'right' }}>
                    {Math.round(gap.current_skills.length / (gap.current_skills.length + gap.missing_skills.length) * 100)}%
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: '.8rem', color: 'var(--text-m)', width: 90 }}>Missing</span>
                  <div style={{ flex: 1, height: 10, background: 'var(--surface3)', borderRadius: 99, overflow: 'hidden' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round(gap.missing_skills.length / (gap.current_skills.length + gap.missing_skills.length) * 100)}%` }} transition={{ duration: 1.2, ease: [0.34,1.2,0.64,1], delay: .1 }}
                      style={{ height: '100%', background: 'linear-gradient(90deg,var(--rose),#fb7185)', borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: '.8rem', fontFamily: 'var(--font-d)', fontWeight: 800, color: 'var(--rose)', width: 36, textAlign: 'right' }}>
                    {Math.round(gap.missing_skills.length / (gap.current_skills.length + gap.missing_skills.length) * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* Closest roles */}
            {gap.closest_job_roles?.length > 0 && (
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="sec-line">🎯 Best Fit Roles</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {gap.closest_job_roles.map(role => (
                    <span key={role} style={{ background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,.22)', color: 'var(--amber)', padding: '7px 16px', borderRadius: 10, fontSize: '.875rem', fontWeight: 700, fontFamily: 'var(--font-d)' }}>{role}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Upskilling roadmap */}
            {gap.upskilling_suggestions?.length > 0 && (
              <div className="card">
                <div className="sec-line">🚀 Upskilling Roadmap</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...gap.upskilling_suggestions]
                    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
                    .map((sug, i) => {
                      const col = getPriorityMeta(sug.priority);
                      return (
                        <motion.div key={sug.skill} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .05 }}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: 14, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: col.bg, border: `1px solid ${col.border}`, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '.85rem', color: col.color, flexShrink: 0 }}>{i + 1}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: 4 }}>{sug.skill}</div>
                            <div style={{ fontSize: '.78rem', color: 'var(--text-m)', lineHeight: 1.5, marginBottom: 6 }}>{sug.reason}</div>
                            <a href={sug.resource} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize: '.78rem', color: 'var(--violet)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>📚 Start Learning →</a>
                          </div>
                          <span style={{ background: col.bg, border: `1px solid ${col.border}`, color: col.color, fontSize: '.68rem', fontWeight: 800, padding: '3px 10px', borderRadius: 99, textTransform: 'capitalize', alignSelf: 'flex-start', flexShrink: 0 }}>{sug.priority}</span>
                        </motion.div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
