'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSkillGap } from '@/lib/api';
import { getPriorityColor, extractError } from '@/lib/utils';
import type { SkillGapData } from '@/types';
import Spinner from '@/components/ui/Spinner';

export default function SkillGapPage() {
  const router = useRouter();
  const [data, setData]       = useState<SkillGapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  const resumeId = typeof window !== 'undefined' ? sessionStorage.getItem('resume_id') || '' : '';

  useEffect(() => {
    if (!resumeId) return;
    setLoading(true);
    getSkillGap(resumeId)
      .then(res => {
        // ⚠️ API: res.data.data is an OBJECT with current_skills, missing_skills, etc.
        if (res.data.success) setData(res.data.data);
      })
      .catch(e => setErr(extractError(e)))
      .finally(() => setLoading(false));
  }, [resumeId]);

  const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

  return (
    <div className="anim-fade-up" style={{ padding: '2.5rem', maxWidth: 1080 }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>
          <span style={{ color: 'var(--text-m)' }}>Candidate</span><span style={{ color: 'var(--border-hi)' }}>›</span>
          <span style={{ color: 'var(--vl)' }}>Skill Gap</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: 6 }}>
          Skill Gap <span className="grad-text">Analysis</span>
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: '.9rem' }}>
          Your current skills vs what the market demands — with personalised upskilling paths
        </p>
      </div>

      {!resumeId && (
        <div style={{ background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 12, padding: '1rem 1.2rem', marginBottom: '1.5rem', color: 'var(--amber)', fontSize: '.875rem' }}>
          ⚠️ No resume found. <button onClick={() => router.push('/candidate/upload')} style={{ background: 'none', border: 'none', color: 'var(--violet)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', fontSize: '.875rem' }}>Upload first →</button>
        </div>
      )}

      {loading && <Spinner message="📊 Analysing Skill Gaps…" sub="Comparing your skills against all available jobs" />}
      {err && <div style={{ background: 'var(--rose-dim)', border: '1px solid rgba(244,63,94,.25)', borderRadius: 12, padding: '1rem', color: 'var(--rose)', marginBottom: '1.5rem', fontSize: '.875rem' }}>⚠️ {err}</div>}

      {data && (
        <div>
          {/* Skills overview grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div className="card">
              <div className="sec-line">✅ Your Current Skills ({data.current_skills.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {data.current_skills.map(s => <span key={s} className="chip chip-blue">{s}</span>)}
                {data.current_skills.length === 0 && <span style={{ fontSize: '.8rem', color: 'var(--text-d)' }}>No skills found</span>}
              </div>
            </div>
            <div className="card">
              <div className="sec-line">⚠️ Market Gaps ({data.missing_skills.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {data.missing_skills.map(s => <span key={s} className="chip chip-red">✗{s}</span>)}
                {data.missing_skills.length === 0 && <span style={{ fontSize: '.875rem', color: 'var(--teal)', fontWeight: 700 }}>🎉 No significant gaps!</span>}
              </div>
            </div>
          </div>

          {/* Closest roles */}
          {data.closest_job_roles?.length > 0 && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="sec-line">🎯 You're a Good Fit For</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {data.closest_job_roles.map(role => (
                  <span key={role} style={{ background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,.22)', color: 'var(--amber)', padding: '7px 16px', borderRadius: 10, fontSize: '.875rem', fontWeight: 700, fontFamily: 'var(--font-d)' }}>{role}</span>
                ))}
              </div>
            </div>
          )}

          {/* Upskilling roadmap */}
          {data.upskilling_suggestions?.length > 0 && (
            <div className="card">
              <div className="sec-line">🚀 Upskilling Roadmap</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...data.upskilling_suggestions]
                  .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
                  .map((sug, i) => {
                    const col = getPriorityColor(sug.priority);
                    return (
                      <div key={sug.skill} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: 14, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: col.bg, border: `1px solid ${col.border}`, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '.85rem', color: col.text, flexShrink: 0 }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: 4 }}>{sug.skill}</div>
                          <div style={{ fontSize: '.78rem', color: 'var(--text-m)', lineHeight: 1.5, marginBottom: 6 }}>{sug.reason}</div>
                          <a href={sug.resource} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: '.78rem', color: 'var(--violet)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            📚 Start Learning →
                          </a>
                        </div>
                        <span style={{ background: col.bg, border: `1px solid ${col.border}`, color: col.text, fontSize: '.68rem', fontWeight: 800, padding: '3px 10px', borderRadius: 99, textTransform: 'capitalize', alignSelf: 'flex-start', flexShrink: 0 }}>
                          {sug.priority} priority
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
