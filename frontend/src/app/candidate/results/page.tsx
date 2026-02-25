'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { matchResumeToJob, listJobs } from '@/lib/api';
import { toInt, extractError } from '@/lib/utils';
import type { MatchResumeToJobResponse, JobData } from '@/types';
import ScoreRing from '@/components/ui/ScoreRing';
import ScoreBar from '@/components/ui/ScoreBar';
import ExplainPanel from '@/components/ui/ExplainPanel';
import Spinner from '@/components/ui/Spinner';

export default function ResultsPage() {
  const router = useRouter();
  const [jobs, setJobs]           = useState<JobData[]>([]);
  const [selectedJob, setSelected] = useState('');
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<MatchResumeToJobResponse | null>(null);
  const [err, setErr]             = useState('');

  // Get resume_id from sessionStorage
  const resumeId = typeof window !== 'undefined' ? sessionStorage.getItem('resume_id') || '' : '';

  useEffect(() => {
    listJobs(1, 50).then(res => {
      if (res.data.success) setJobs(res.data.data);
    }).catch(() => {});
  }, []);

  const handleMatch = async () => {
    if (!resumeId || !selectedJob) return;
    setLoading(true); setErr(''); setResult(null);
    try {
      const res = await matchResumeToJob(resumeId, selectedJob);
      // ⚠️ API: fields are TOP-LEVEL — res.data.scores, NOT res.data.data.scores
      if (!res.data.success) throw new Error('Match failed');
      setResult(res.data);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="anim-fade-up" style={{ padding: '2.5rem', maxWidth: 1080 }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>
          <span style={{ color: 'var(--text-m)' }}>Candidate</span>
          <span style={{ color: 'var(--border-hi)' }}>›</span>
          <span style={{ color: 'var(--vl)' }}>Match Results</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: 6 }}>
          Match <span className="grad-text">Results</span>
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: '.9rem' }}>Select a job to see your AI compatibility score across 3 layers</p>
      </div>

      {!resumeId && (
        <div style={{ background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 12, padding: '1rem 1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>⚠️</span>
          <span style={{ fontSize: '.875rem', color: 'var(--amber)' }}>No resume found. <button onClick={() => router.push('/candidate/upload')} style={{ background: 'none', border: 'none', color: 'var(--violet)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', fontSize: '.875rem' }}>Upload a resume first →</button></span>
        </div>
      )}

      {/* Job selector */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="sec-line">Select a Job to Match Against</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="field-input" style={{ maxWidth: 380, cursor: 'pointer' }}
            value={selectedJob} onChange={e => setSelected(e.target.value)}>
            <option value="">-- Choose a job --</option>
            {jobs.map(j => (
              <option key={j.job_id} value={j.job_id}>{j.title} @ {j.company}</option>
            ))}
          </select>
          <button onClick={handleMatch} disabled={!resumeId || !selectedJob || loading}
            className="btn-primary" style={{ padding: '10px 24px', borderRadius: 10, fontSize: '.875rem' }}>
            {loading ? '⏳ Matching…' : '🎯 Match Now'}
          </button>
          {jobs.length === 0 && (
            <span style={{ fontSize: '.8rem', color: 'var(--text-m)' }}>
              No jobs yet — <button onClick={() => router.push('/recruiter/post-job')} style={{ background: 'none', border: 'none', color: 'var(--violet)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', fontSize: '.8rem' }}>post one first</button>
            </span>
          )}
        </div>
      </div>

      {loading && <Spinner message="🧠 Computing AI Match…" sub="Running semantic + keyword + experience layers" />}

      {err && (
        <div style={{ background: 'var(--rose-dim)', border: '1px solid rgba(244,63,94,.25)', borderRadius: 12, padding: '1rem 1.2rem', marginBottom: '1.5rem', color: 'var(--rose)', fontSize: '.875rem' }}>
          ⚠️ {err}
        </div>
      )}

      {result && (
        <div className="anim-fade-up">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.75rem', marginBottom: '1.5rem' }}>
            {/* Score breakdown */}
            <div className="card">
              <div className="sec-line">Score Breakdown</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '1.5rem' }}>
                {/* Ring — final_score is 0.0-1.0 */}
                <ScoreRing score={result.scores.final_score} size={110} />
                <div style={{ flex: 1 }}>
                  <ScoreBar label="Semantic Similarity"    value={toInt(result.scores.semantic_score)}    variant="violet" sublabel="MiniLM cosine" />
                  <ScoreBar label="Keyword Score"         value={toInt(result.scores.keyword_score)}     variant="teal"   sublabel="TF-IDF" />
                  <ScoreBar label="Experience Match"      value={toInt(result.scores.experience_score)}  variant="amber"  sublabel="Years vs required" />
                </div>
              </div>
              {/* Formula */}
              <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px', fontSize: '.78rem', color: 'var(--text-m)', lineHeight: 1.7 }}>
                <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>Score Formula</strong>
                Final = (Semantic × {result.weights_used.semantic}) + (Keyword × {result.weights_used.keyword}) + (Experience × {result.weights_used.experience})<br />
                = <strong style={{ color: 'var(--teal)' }}>{toInt(result.scores.final_score)}%</strong>
              </div>
            </div>

            {/* XAI panel */}
            <ExplainPanel ex={result.explainability} />
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button onClick={() => router.push('/candidate/jobs')} className="btn-primary" style={{ padding: '10px 24px', borderRadius: 10, fontSize: '.875rem' }}>
              See All Recommendations →
            </button>
            <button onClick={() => router.push('/candidate/skills-gap')} className="btn-secondary" style={{ padding: '10px 24px', borderRadius: 10, fontSize: '.875rem' }}>
              Skill Gap Analysis
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
