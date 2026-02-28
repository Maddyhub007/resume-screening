'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useListJobs, useMatchMutation } from '@/lib/hooks/useQueries';
import { useAppStore } from '@/lib/store/appStore';
import { toInt, getScoreMeta } from '@/lib/utils/scores';
import ScoreRing from '@/components/ui/ScoreRing';
import ScoreBar from '@/components/ui/ScoreBar';
import ExplainPanel from '@/components/ui/ExplainPanel';
import EmptyState from '@/components/ui/EmptyState';
import { ScoreCardSkeleton } from '@/components/ui/Skeleton';
import type { MatchResumeToJobResponse } from '@/types';

export default function ResultsPage() {
  const router = useRouter();
  const resumeId = useAppStore(s => s.resumeId);
  const { data: jobsData, isLoading: jobsLoading } = useListJobs(1, 50);
  const { mutate: runMatch, isPending } = useMatchMutation();
  const [selectedJob, setSelectedJob] = useState('');
  const [result, setResult] = useState<MatchResumeToJobResponse | null>(null);

  const jobs = jobsData?.data ?? [];

  const handleMatch = () => {
    if (!resumeId || !selectedJob) return;
    runMatch({ resumeId, jobId: selectedJob }, {
      onSuccess: (data) => setResult(data),
    });
  };

  return (
    <div style={{ padding: '2.5rem', maxWidth: 1080 }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>
          <span style={{ color: 'var(--text-m)' }}>Candidate</span><span style={{ color: 'var(--border-hi)' }}>›</span><span style={{ color: 'var(--vl)' }}>Match Results</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: 6 }}>Match <span className="grad-text">Results</span></h1>
        <p style={{ color: 'var(--text2)', fontSize: '.9rem', marginBottom: '1.5rem' }}>Select a job to see your 3-layer AI compatibility score</p>

        {!resumeId && (
          <div style={{ background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 12, padding: '1rem 1.2rem', marginBottom: '1.5rem', color: 'var(--amber)', fontSize: '.875rem' }}>
            ⚠️ No resume found. <button onClick={() => router.push('/candidate/upload')} style={{ background: 'none', border: 'none', color: 'var(--violet)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', fontSize: '.875rem' }}>Upload first →</button>
          </div>
        )}

        {/* Job selector */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="sec-line">Select Job to Match Against</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="field-input" style={{ maxWidth: 380, cursor: 'pointer' }}
              value={selectedJob} onChange={e => setSelectedJob(e.target.value)}>
              <option value="">-- Choose a job --</option>
              {jobs.map(j => <option key={j.job_id} value={j.job_id}>{j.title} @ {j.company}</option>)}
            </select>
            <motion.button whileHover={{ y: -1 }} whileTap={{ scale: .98 }}
              onClick={handleMatch} disabled={!resumeId || !selectedJob || isPending}
              className="btn-primary" style={{ padding: '10px 24px', borderRadius: 10, fontSize: '.875rem' }}>
              {isPending ? '⏳ Matching…' : '🎯 Match Now'}
            </motion.button>
            {jobsLoading && <span style={{ fontSize: '.8rem', color: 'var(--text-m)' }}>Loading jobs…</span>}
            {!jobsLoading && jobs.length === 0 && (
              <span style={{ fontSize: '.8rem', color: 'var(--text-m)' }}>No jobs yet — <button onClick={() => router.push('/recruiter/post-job')} style={{ background: 'none', border: 'none', color: 'var(--violet)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', fontSize: '.8rem' }}>post one first</button></span>
            )}
          </div>
        </div>

        {isPending && <ScoreCardSkeleton />}

        {result && !isPending && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            {/* Banner */}
            {(() => {
              const meta = getScoreMeta(result.scores.final_score);
              const isExcellent = result.scores.final_score >= 0.8;
              const isWeak = result.scores.final_score < 0.5;
              return (
                <div style={{ background: isExcellent ? 'rgba(16,185,129,.08)' : isWeak ? 'var(--rose-dim)' : 'var(--vd)', border: `1px solid ${isExcellent ? 'rgba(16,185,129,.25)' : isWeak ? 'rgba(244,63,94,.25)' : 'rgba(124,106,247,.25)'}`, borderRadius: 12, padding: '1rem 1.4rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.3rem' }}>{isExcellent ? '🎉' : isWeak ? '⚠️' : '💡'}</span>
                  <div>
                    <div style={{ fontFamily: 'var(--font-d)', fontWeight: 700, fontSize: '.9rem', marginBottom: 2 }}>{isExcellent ? 'Great Match! Consider applying right away.' : isWeak ? 'Improve Before Applying' : 'Strong candidate — a few gaps to address.'}</div>
                    <div style={{ fontSize: '.78rem', color: 'var(--text-m)' }}>{meta.label} · {toInt(result.scores.final_score)}% overall score</div>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.75rem', marginBottom: '1.5rem' }}>
              <div className="card">
                <div className="sec-line">Score Breakdown</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', marginBottom: '1.5rem' }}>
                  <ScoreRing score={result.scores.final_score} size={110} />
                  <div style={{ flex: 1 }}>
                    <ScoreBar label="Semantic Similarity" value={toInt(result.scores.semantic_score)} variant="violet" sublabel="MiniLM" />
                    <ScoreBar label="Keyword Score"       value={toInt(result.scores.keyword_score)}  variant="teal"   sublabel="TF-IDF" />
                    <ScoreBar label="Experience Match"    value={toInt(result.scores.experience_score)} variant="amber" sublabel="Years" />
                  </div>
                </div>
                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px', fontSize: '.78rem', color: 'var(--text-m)', lineHeight: 1.7 }}>
                  <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>Score Formula</strong>
                  Final = (Semantic × {result.weights_used.semantic}) + (Keyword × {result.weights_used.keyword}) + (Experience × {result.weights_used.experience}) = <strong style={{ color: 'var(--teal)' }}>{toInt(result.scores.final_score)}%</strong>
                </div>
              </div>
              <ExplainPanel ex={result.explainability} />
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button onClick={() => router.push('/candidate/jobs')} className="btn-primary" style={{ padding: '10px 24px', borderRadius: 10, fontSize: '.875rem' }}>See All Recommendations →</button>
              <button onClick={() => router.push('/candidate/skills-gap')} className="btn-secondary" style={{ padding: '10px 24px', borderRadius: 10, fontSize: '.875rem' }}>Skill Gap Analysis</button>
            </div>
          </motion.div>
        )}

        {!result && !isPending && resumeId && (
          <EmptyState icon="🎯" title="Select a job above" message="Choose any job from the dropdown and click Match Now to see your AI score." />
        )}
      </motion.div>
    </div>
  );
}
