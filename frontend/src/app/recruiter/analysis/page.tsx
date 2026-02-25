'use client';
// src/app/recruiter/analysis/page.tsx
// Reads the candidate stored in sessionStorage('selected_candidate') by the
// Candidates page, and shows the full XAI breakdown + actions.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { matchResumeToJob } from '@/lib/api';
import { toInt, getScoreLabel, extractError } from '@/lib/utils';
import type { RankedCandidate, MatchResumeToJobResponse } from '@/types';
import ScoreRing from '@/components/ui/ScoreRing';
import ScoreBar  from '@/components/ui/ScoreBar';
import ExplainPanel from '@/components/ui/ExplainPanel';
import Spinner from '@/components/ui/Spinner';
import Toast from '@/components/ui/Toast';

export default function AnalysisPage() {
  const router = useRouter();
  const [candidate, setCandidate] = useState<RankedCandidate | null>(null);
  const [detail, setDetail]       = useState<MatchResumeToJobResponse | null>(null);
  const [loading, setLoading]     = useState(false);
  const [notes, setNotes]         = useState('');
  const [toast, setToast]         = useState<{icon:string;title:string;msg:string}|null>(null);

  const jobId = typeof window !== 'undefined' ? sessionStorage.getItem('job_id') || '' : '';

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? sessionStorage.getItem('selected_candidate') : null;
    if (!raw) { router.replace('/recruiter/candidates'); return; }
    const cand: RankedCandidate = JSON.parse(raw);
    setCandidate(cand);

    // Fetch live detailed match if job_id available
    if (jobId && cand.resume_id) {
      setLoading(true);
      matchResumeToJob(cand.resume_id, jobId)
        .then(res => { if (res.data.success) setDetail(res.data); })
        .catch(() => { /* use data from sessionStorage as fallback */ })
        .finally(() => setLoading(false));
    }
  }, [jobId, router]);

  if (!candidate) return <Spinner message="Loading candidate…" />;

  // Prefer live detail scores, fall back to rank data
  const scores       = detail?.scores ?? candidate.scores;
  const explainability = detail?.explainability ?? candidate.explainability;
  const finalPct     = toInt(scores.final_score);
  const scoreMeta    = getScoreLabel(scores.final_score);
  const pillCls      = scoreMeta.color === 'green' ? 'pill-green' : scoreMeta.color === 'yellow' ? 'pill-yellow' : scoreMeta.color === 'orange' ? 'pill-orange' : 'pill-red';

  const initials = candidate.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const action = (label: string, icon: string) => {
    setToast({ icon, title: label, msg: `Action recorded for ${candidate.name}` });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="anim-fade-up" style={{ padding: '2.5rem', maxWidth: 1080 }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>
          <span style={{ color: 'var(--text-m)' }}>Recruiter</span>
          <span style={{ color: 'var(--border-hi)' }}>›</span>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--tl)', cursor: 'pointer', fontWeight: 800, padding: 0, fontSize: '.68rem', textTransform: 'uppercase', letterSpacing: '.12em' }}>Rankings</button>
          <span style={{ color: 'var(--border-hi)' }}>›</span>
          <span style={{ color: 'var(--tl)' }}>Analysis</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: 6 }}>
              Analysis <span className="grad-text">Panel</span>
            </h1>
            <p style={{ color: 'var(--text2)', fontSize: '.9rem' }}>Full AI breakdown for this candidate</p>
          </div>
          <button onClick={() => router.back()} className="btn-ghost" style={{ padding: '9px 18px', borderRadius: 10, fontSize: '.85rem' }}>
            ← Back to Rankings
          </button>
        </div>
      </div>

      {/* Candidate profile banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124,106,247,.08), rgba(45,212,191,.04))',
        border: '1px solid var(--border-hi)', borderRadius: 20,
        padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem',
        flexWrap: 'wrap', marginBottom: '1.75rem',
      }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,var(--violet),var(--teal))', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '1.2rem', color: '#fff', flexShrink: 0, boxShadow: '0 4px 16px rgba(124,106,247,.35)' }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '1.1rem', marginBottom: 3 }}>{candidate.name}</div>
          <div style={{ fontSize: '.82rem', color: 'var(--text-m)' }}>{candidate.email}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <span style={{ background: 'var(--vd)', border: '1px solid rgba(124,106,247,.22)', color: 'var(--violet)', padding: '2px 10px', borderRadius: 99, fontSize: '.7rem', fontWeight: 800 }}>Rank #{candidate.rank}</span>
            <span className={`pill ${pillCls}`} style={{ fontSize: '.72rem', padding: '2px 10px' }}>{finalPct}% — {scoreMeta.label}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => action('Interview Scheduled', '📅')} className="btn-primary" style={{ padding: '9px 18px', borderRadius: 10, fontSize: '.875rem' }}>
            📅 Schedule Interview
          </button>
          <button onClick={() => action('Email Sent', '📧')} className="btn-secondary" style={{ padding: '9px 18px', borderRadius: 10, fontSize: '.875rem' }}>
            📧 Send Email
          </button>
          <button onClick={() => action('Candidate Rejected', '✗')} className="btn-danger" style={{ padding: '9px 18px', borderRadius: 10, fontSize: '.875rem' }}>
            ✗ Reject
          </button>
        </div>
      </div>

      {loading && <Spinner message="🔍 Loading live match details…" sub="Fetching from AI engine" />}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.75rem', marginBottom: '1.5rem' }}>
          {/* Left — scores */}
          <div>
            <div className="card" style={{ marginBottom: '1.25rem' }}>
              <div className="sec-line">Score Breakdown</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '1.5rem' }}>
                <ScoreRing score={scores.final_score} size={110} />
                <div style={{ flex: 1 }}>
                  <ScoreBar label="Semantic Similarity" value={toInt(scores.semantic_score)}   variant="violet" sublabel="MiniLM cosine" />
                  <ScoreBar label="Keyword Score"        value={toInt(scores.keyword_score)}    variant="teal"   sublabel="TF-IDF" />
                  <ScoreBar label="Experience Match"     value={toInt(scores.experience_score)} variant="amber"  sublabel="Years vs req." />
                </div>
              </div>
              {/* Formula */}
              {detail?.weights_used && (
                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px', fontSize: '.78rem', color: 'var(--text-m)', lineHeight: 1.7 }}>
                  <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>Score Formula</strong>
                  Final = (Semantic × {detail.weights_used.semantic}) + (Keyword × {detail.weights_used.keyword}) + (Experience × {detail.weights_used.experience})
                  {' '}= <strong style={{ color: 'var(--teal)' }}>{finalPct}%</strong>
                </div>
              )}
            </div>

            {/* Skill breakdown */}
            <div className="card">
              <div className="sec-line">📚 Skill Breakdown</div>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '.65rem', fontWeight: 800, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 7 }}>✓ Matched ({explainability.matched_skills.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {explainability.matched_skills.length > 0
                    ? explainability.matched_skills.map(s => <span key={s} className="chip chip-green">{s}</span>)
                    : <span style={{ fontSize: '.8rem', color: 'var(--text-d)' }}>None matched</span>}
                </div>
              </div>
              {explainability.extra_skills?.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '.65rem', fontWeight: 800, color: 'var(--text-m)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 7 }}>+ Bonus Skills</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {explainability.extra_skills.map(s => <span key={s} className="chip chip-grey">{s}</span>)}
                  </div>
                </div>
              )}
              <div>
                <div style={{ fontSize: '.65rem', fontWeight: 800, color: 'var(--rose)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 7 }}>✗ Missing ({explainability.missing_skills.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {explainability.missing_skills.length > 0
                    ? explainability.missing_skills.map(s => <span key={s} className="chip chip-red">{s}</span>)
                    : <span style={{ fontSize: '.78rem', color: 'var(--teal)', fontWeight: 700 }}>✦ All required skills matched!</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Right — XAI + actions */}
          <div>
            <ExplainPanel ex={explainability} />

            {/* Recruiter notes */}
            <div className="card" style={{ marginTop: '1.25rem' }}>
              <div className="sec-line">Recruiter Notes</div>
              <textarea
                className="field-input"
                style={{ resize: 'vertical', minHeight: 90, lineHeight: 1.65 }}
                placeholder={`Add private notes about ${candidate.name}…`}
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
              <button
                onClick={() => { setToast({ icon: '📝', title: 'Notes Saved', msg: 'Your notes have been recorded.' }); setTimeout(() => setToast(null), 2500); }}
                style={{ marginTop: 8, background: 'var(--td)', border: '1px solid rgba(45,212,191,.25)', color: 'var(--teal)', padding: '7px 16px', borderRadius: 8, fontSize: '.8rem', fontWeight: 700, cursor: 'pointer' }}>
                Save Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast icon={toast.icon} title={toast.title} message={toast.msg} onClose={() => setToast(null)} />}
    </div>
  );
}
