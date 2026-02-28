'use client';
import { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useListJobs, useRankCandidates } from '@/lib/hooks/useQueries';
import { useAppStore } from '@/lib/store/appStore';
import { toInt, getScoreMeta } from '@/lib/utils/scores';
import { TableSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import type { RankedCandidate } from '@/types';

function RankBadge({ rank }: { rank: number }) {
  const bg = rank === 1 ? '#f59e0b' : rank === 2 ? '#9ca3af' : rank === 3 ? '#b45309' : 'var(--surface3)';
  return (
    <div style={{ width: 28, height: 28, borderRadius: 8, background: bg, color: rank <= 3 ? '#000' : 'var(--text-m)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-d)', fontSize: '.8rem', fontWeight: 800 }}>
      #{rank}
    </div>
  );
}

function CandidatesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const setSelectedCandidate = useAppStore(s => s.setSelectedCandidate);
  const storeJobId = useAppStore(s => s.jobId);
  const setJobId = useAppStore(s => s.setJobId);

  const [selectedJob, setSelectedJob] = useState(searchParams.get('job') ?? storeJobId ?? '');
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [sortBy, setSortBy] = useState<'rank' | 'final' | 'semantic'>('rank');

  const { data: jobsData } = useListJobs(1, 50);
  const { data: rankData, isLoading: rankLoading, error } = useRankCandidates(selectedJob || null);

  const jobs = jobsData?.data ?? [];
  const candidates: RankedCandidate[] = rankData?.data ?? [];

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedJob) params.set('job', selectedJob);
    if (query) params.set('q', query);
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname);
  }, [selectedJob, query, pathname]);

  const handleJobChange = (jobId: string) => {
    setSelectedJob(jobId);
    setJobId(jobId);
  };

  const filtered = useMemo(() => candidates
    .filter(c => !query || c.name.toLowerCase().includes(query.toLowerCase()) || c.email.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) =>
      sortBy === 'rank'  ? a.rank - b.rank :
      sortBy === 'final' ? b.scores.final_score - a.scores.final_score :
                           b.scores.semantic_score - a.scores.semantic_score
    ), [candidates, query, sortBy]);

  const openAnalysis = (c: RankedCandidate) => {
    setSelectedCandidate(c);
    router.push('/recruiter/analysis');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>
        <span style={{ color: 'var(--text-m)' }}>Recruiter</span>
        <span style={{ color: 'var(--border-hi)' }}>›</span>
        <span style={{ color: 'var(--tl)' }}>Rankings</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: 6 }}>
            Candidate <span className="grad-text">Rankings</span>
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: '.9rem' }}>AI-ranked candidates for the selected job</p>
        </div>
        <button onClick={() => router.push('/recruiter/post-job')} className="btn-primary" style={{ padding: '10px 20px', borderRadius: 10, fontSize: '.875rem' }}>
          + Post New Job
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="sec-line">Select Job</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="field-input" style={{ maxWidth: 380, cursor: 'pointer' }}
            value={selectedJob} onChange={e => handleJobChange(e.target.value)}>
            <option value="">-- Choose a job --</option>
            {jobs.map(j => <option key={j.job_id} value={j.job_id}>{j.title} @ {j.company}</option>)}
          </select>
          {rankData && (
            <span style={{ fontSize: '.8rem', color: 'var(--text-m)', fontWeight: 600 }}>
              {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} ranked
            </span>
          )}
        </div>
      </div>

      {candidates.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-d)', pointerEvents: 'none' }}>🔍</span>
            <input className="field-input" style={{ paddingLeft: 36 }} placeholder="Search candidates…"
              value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['rank', 'final', 'semantic'] as const).map(v => (
              <button key={v} onClick={() => setSortBy(v)}
                style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${sortBy === v ? 'var(--violet)' : 'var(--border)'}`, background: sortBy === v ? 'var(--vd)' : 'none', color: sortBy === v ? 'var(--violet)' : 'var(--text-m)', fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', fontFamily: 'var(--font-b)' }}>
                {v === 'final' ? 'Final Score' : v === 'semantic' ? 'Semantic' : 'Rank'}
              </button>
            ))}
          </div>
        </div>
      )}

      {rankLoading && <TableSkeleton rows={6} />}
      {error && (
        <div style={{ background: 'var(--rose-dim)', border: '1px solid rgba(244,63,94,.25)', borderRadius: 12, padding: '1rem', color: 'var(--rose)', fontSize: '.875rem' }}>
          Failed to rank candidates. Is the backend running?
        </div>
      )}
      {!rankLoading && selectedJob && candidates.length === 0 && !error && (
        <EmptyState icon="👥" title="No candidates yet" message="Upload resumes via the Candidate dashboard first." />
      )}
      {!selectedJob && !rankLoading && (
        <EmptyState icon="📋" title="Select a job above" message="Choose a job to see all uploaded candidates ranked by AI score." />
      )}

      {filtered.length > 0 && (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th><th>Candidate</th><th>Semantic</th><th>Keyword</th>
                <th>Experience</th><th>Final Score</th><th>Skills</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const meta = getScoreMeta(c.scores.final_score);
                return (
                  <tr key={c.resume_id}
                    onClick={() => openAnalysis(c)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,.025)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}>
                    <td><RankBadge rank={c.rank} /></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,var(--violet),var(--teal))', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '.8rem', color: '#fff', flexShrink: 0 }}>
                          {c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '.875rem' }}>{c.name}</div>
                          <div style={{ fontSize: '.72rem', color: 'var(--text-m)' }}>{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="score-track" style={{ width: 60 }}>
                          <div className="score-fill" style={{ width: `${toInt(c.scores.semantic_score)}%`, background: 'linear-gradient(90deg,var(--violet),var(--vl))' }} />
                        </div>
                        <span style={{ fontSize: '.78rem', fontFamily: 'var(--font-d)', fontWeight: 700 }}>{toInt(c.scores.semantic_score)}%</span>
                      </div>
                    </td>
                    <td><span style={{ fontSize: '.78rem', fontFamily: 'var(--font-d)', fontWeight: 700, color: 'var(--teal)' }}>{toInt(c.scores.keyword_score)}%</span></td>
                    <td><span style={{ fontSize: '.78rem', fontFamily: 'var(--font-d)', fontWeight: 700, color: 'var(--amber)' }}>{toInt(c.scores.experience_score)}%</span></td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-d)', fontWeight: 800, padding: '4px 12px', borderRadius: 99, fontSize: '.82rem', background: `${meta.cssVar}18`, border: `1px solid ${meta.cssVar}40`, color: meta.cssVar }}>
                        {toInt(c.scores.final_score)}%
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 200 }}>
                        {c.explainability.matched_skills.slice(0, 2).map(s => <span key={s} className="chip chip-green" style={{ fontSize: '.68rem' }}>{s}</span>)}
                        {c.explainability.missing_skills.slice(0, 1).map(s => <span key={s} className="chip chip-red" style={{ fontSize: '.68rem' }}>✗{s}</span>)}
                      </div>
                    </td>
                    <td>
                      <button onClick={e => { e.stopPropagation(); openAnalysis(c); }} className="btn-ghost" style={{ padding: '5px 12px', borderRadius: 8, fontSize: '.75rem' }}>
                        Analyse →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}

export default function CandidatesPage() {
  return (
    <div style={{ padding: '2.5rem', maxWidth: 1080 }}>
      <Suspense fallback={<TableSkeleton rows={6} />}>
        <CandidatesContent />
      </Suspense>
    </div>
  );
}
