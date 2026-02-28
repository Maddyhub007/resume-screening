'use client';
import { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useRecommendJobs, useMatchMutation } from '@/lib/hooks/useQueries';
import { useAppStore } from '@/lib/store/appStore';
import { toInt, getScoreMeta } from '@/lib/utils/scores';
import ScoreRing from '@/components/ui/ScoreRing';
import ScoreBar from '@/components/ui/ScoreBar';
import ExplainPanel from '@/components/ui/ExplainPanel';
import { JobCardSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import type { JobRecommendation, MatchResumeToJobResponse } from '@/types';

function ScorePill({ score }: { score: number }) {
  const m = getScoreMeta(score);
  return (
    <span style={{ fontFamily: 'var(--font-d)', fontWeight: 800, padding: '4px 12px', borderRadius: 99, fontSize: '.82rem', background: `${m.cssVar}18`, border: `1px solid ${m.cssVar}40`, color: m.cssVar }}>
      {toInt(score)}%
    </span>
  );
}

const COLORS = ['#7c6af7','#2dd4bf','#f43f5e','#f59e0b','#3b82f6','#8b5cf6','#06b6d4','#10b981'];

// Inner component — uses useSearchParams, must be inside Suspense
function JobsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const resumeId = useAppStore(s => s.resumeId);
  const { data, isLoading, error } = useRecommendJobs(resumeId);
  const { mutate: runMatch, isPending: matchPending } = useMatchMutation();

  const [query, setQuery]   = useState(searchParams.get('q') ?? '');
  const [filter, setFilter] = useState(searchParams.get('tier') ?? 'all');
  const [selected, setSelected] = useState<JobRecommendation | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResumeToJobResponse | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Sync filters → URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (filter !== 'all') params.set('tier', filter);
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname);
  }, [query, filter, pathname]);

  const handleSearch = (val: string) => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setQuery(val), 300);
  };

  const jobs = data?.data ?? [];

  const filtered = useMemo(() => jobs.filter(j => {
    const tierOk =
      filter === 'all'       ? true :
      filter === 'excellent' ? j.final_score >= 0.8 :
      filter === 'strong'    ? j.final_score >= 0.65 && j.final_score < 0.8 :
      j.final_score < 0.65;
    const q = query.toLowerCase();
    const qOk = !q || j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q);
    return tierOk && qOk;
  }), [jobs, filter, query]);

  const handleCardClick = (job: JobRecommendation) => {
    setSelected(job); setMatchResult(null);
    if (!resumeId) return;
    runMatch({ resumeId, jobId: job.job_id }, { onSuccess: d => setMatchResult(d) });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>
        <span style={{ color: 'var(--text-m)' }}>Candidate</span>
        <span style={{ color: 'var(--border-hi)' }}>›</span>
        <span style={{ color: 'var(--vl)' }}>Jobs</span>
      </div>
      <h1 style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: 6 }}>
        Job <span className="grad-text">Recommendations</span>
      </h1>
      <p style={{ color: 'var(--text2)', fontSize: '.9rem', marginBottom: '1.5rem' }}>Personalised matches ranked by semantic AI score</p>

      {!resumeId && (
        <div style={{ background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 12, padding: '1rem 1.2rem', marginBottom: '1.5rem', color: 'var(--amber)', fontSize: '.875rem' }}>
          ⚠️ No resume found.{' '}
          <button onClick={() => router.push('/candidate/upload')} style={{ background: 'none', border: 'none', color: 'var(--violet)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', fontSize: '.875rem' }}>
            Upload first →
          </button>
        </div>
      )}

      {/* Filter row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 360 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-d)', pointerEvents: 'none' }}>🔍</span>
          <input className="field-input" style={{ paddingLeft: 36 }} placeholder="Search roles, companies…"
            defaultValue={query} onChange={e => handleSearch(e.target.value)} />
        </div>
        {([['all','All'],['excellent','Excellent 80%+'],['strong','Strong 65%+'],['other','Partial']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            style={{ padding: '7px 14px', borderRadius: 99, border: `1px solid ${filter === v ? 'var(--violet)' : 'var(--border)'}`, background: filter === v ? 'var(--vd)' : 'none', color: filter === v ? 'var(--violet)' : 'var(--text-m)', fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font-b)' }}>
            {l}
          </button>
        ))}
      </div>

      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '1.25rem' }}>
          {Array.from({ length: 6 }).map((_, i) => <JobCardSkeleton key={i} />)}
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--rose-dim)', border: '1px solid rgba(244,63,94,.25)', borderRadius: 12, padding: '1rem', color: 'var(--rose)', fontSize: '.875rem' }}>
          Failed to load recommendations. Is the backend running?
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && jobs.length === 0 && resumeId && (
        <EmptyState icon="💼" title="No jobs to match" message="Post some jobs in the Recruiter dashboard first."
          cta={{ label: 'Post a Job →', href: '/recruiter/post-job' }} />
      )}

      {/* Job grid */}
      {!isLoading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          {filtered.map((job, idx) => {
            const color = COLORS[idx % COLORS.length];
            return (
              <motion.div key={job.job_id} whileHover={{ y: -3, boxShadow: '0 12px 40px rgba(0,0,0,.4)' }}
                onClick={() => handleCardClick(job)}
                style={{ background: 'var(--surface)', border: `1px solid ${selected?.job_id === job.job_id ? 'var(--violet)' : 'var(--border)'}`, borderRadius: 20, padding: '1.4rem', cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'border-color .2s' }}>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},var(--teal))` }} />
                <div style={{ position: 'absolute', top: 14, right: 14, background: `${color}18`, color, border: `1px solid ${color}30`, fontSize: '.68rem', fontWeight: 800, padding: '3px 9px', borderRadius: 99, fontFamily: 'var(--font-d)' }}>
                  #{job.rank}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}18`, border: `1px solid ${color}25`, display: 'grid', placeItems: 'center', fontSize: '1.1rem', flexShrink: 0 }}>🏢</div>
                  <span style={{ fontSize: '.78rem', color: 'var(--text-m)', fontWeight: 600 }}>{job.company}</span>
                </div>
                <h3 style={{ fontFamily: 'var(--font-d)', fontSize: '.95rem', fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>{job.title}</h3>
                <p style={{ fontSize: '.79rem', color: 'var(--text-m)', lineHeight: 1.6, marginBottom: 12 }}>{job.summary}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                  {job.matched_skills.slice(0, 3).map(s => <span key={s} className="chip chip-green">{s}</span>)}
                  {job.missing_skills.slice(0, 2).map(s => <span key={s} className="chip chip-red">✗{s}</span>)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: '.68rem', color: 'var(--text-m)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Match Score</div>
                    <div style={{ width: 90, height: 5, background: 'var(--surface3)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${toInt(job.final_score)}%`, background: `linear-gradient(90deg,${color},${color}99)`, borderRadius: 99 }} />
                    </div>
                  </div>
                  <ScorePill score={job.final_score} />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="card" style={{ borderColor: 'var(--border-hi)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-d)', fontSize: '1.2rem', fontWeight: 800 }}>{selected.title}</h2>
                <div style={{ fontSize: '.85rem', color: 'var(--text-m)' }}>{selected.company} · {selected.location} · {selected.job_type}</div>
              </div>
              <button onClick={() => setSelected(null)} className="btn-ghost" style={{ padding: '7px 14px', borderRadius: 8, fontSize: '.8rem' }}>✕ Close</button>
            </div>
            {matchPending && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-m)', fontSize: '.875rem', marginBottom: '1rem' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'var(--violet)', animation: 'spin .8s linear infinite', flexShrink: 0 }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                Loading detailed match…
              </div>
            )}
            {matchResult && !matchPending && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                  <div className="sec-line">Score</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
                    <ScoreRing score={matchResult.scores.final_score} size={100} />
                    <div style={{ flex: 1 }}>
                      <ScoreBar label="Semantic"   value={toInt(matchResult.scores.semantic_score)}   variant="violet" />
                      <ScoreBar label="Keyword"    value={toInt(matchResult.scores.keyword_score)}    variant="teal"   />
                      <ScoreBar label="Experience" value={toInt(matchResult.scores.experience_score)} variant="amber"  />
                    </div>
                  </div>
                </div>
                <ExplainPanel ex={matchResult.explainability} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Page component — wraps inner in Suspense (required for useSearchParams in Next.js 14)
export default function JobsPage() {
  return (
    <div style={{ padding: '2.5rem', maxWidth: 1080 }}>
      <Suspense fallback={
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '1.25rem' }}>
          {Array.from({ length: 6 }).map((_, i) => <JobCardSkeleton key={i} />)}
        </div>
      }>
        <JobsContent />
      </Suspense>
    </div>
  );
}
