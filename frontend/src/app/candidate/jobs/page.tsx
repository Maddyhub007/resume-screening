'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { recommendJobs, matchResumeToJob } from '@/lib/api';
import { toInt, getScoreLabel, extractError } from '@/lib/utils';
import type { JobRecommendation } from '@/types';
import Spinner from '@/components/ui/Spinner';
import ExplainPanel from '@/components/ui/ExplainPanel';
import ScoreRing from '@/components/ui/ScoreRing';

function ScorePill({ score }: { score: number }) {
  const m = getScoreLabel(score);
  const cls = m.color === 'green' ? 'pill-green' : m.color === 'yellow' ? 'pill-yellow' : m.color === 'orange' ? 'pill-orange' : 'pill-red';
  return <span className={`pill ${cls}`}>{toInt(score)}%</span>;
}

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs]       = useState<JobRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const [filter, setFilter]   = useState('all');
  const [query, setQuery]     = useState('');
  const [selected, setSelected] = useState<JobRecommendation | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchResult, setMatchResult]   = useState<import('@/types').MatchResumeToJobResponse | null>(null);

  const resumeId = typeof window !== 'undefined' ? sessionStorage.getItem('resume_id') || '' : '';

  useEffect(() => {
    if (!resumeId) return;
    setLoading(true);
    recommendJobs(resumeId, 10)
      .then(res => {
        // ⚠️ API: res.data.data is a FLAT ARRAY
        if (res.data.success) setJobs(res.data.data);
      })
      .catch(e => setErr(extractError(e)))
      .finally(() => setLoading(false));
  }, [resumeId]);

  const filtered = jobs.filter(j => {
    const matchesFilter =
      filter === 'all' ? true :
      filter === 'excellent' ? j.final_score >= 0.8 :
      filter === 'strong'    ? j.final_score >= 0.65 && j.final_score < 0.8 :
      j.final_score < 0.65;
    const q = query.toLowerCase();
    const matchesQuery = !q || j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q);
    return matchesFilter && matchesQuery;
  });

  const handleCardClick = async (job: JobRecommendation) => {
    setSelected(job); setMatchResult(null);
    if (!resumeId) return;
    setMatchLoading(true);
    try {
      const res = await matchResumeToJob(resumeId, job.job_id);
      // ⚠️ res.data.scores — top level
      if (res.data.success) setMatchResult(res.data);
    } catch { /* ignore */ }
    finally { setMatchLoading(false); }
  };

  const COLORS = ['#7c6af7','#2dd4bf','#f43f5e','#f59e0b','#3b82f6','#8b5cf6','#06b6d4'];

  return (
    <div className="anim-fade-up" style={{ padding: '2.5rem', maxWidth: 1080 }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>
          <span style={{ color: 'var(--text-m)' }}>Candidate</span><span style={{ color: 'var(--border-hi)' }}>›</span>
          <span style={{ color: 'var(--vl)' }}>Jobs</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: 6 }}>
          Job <span className="grad-text">Recommendations</span>
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: '.9rem' }}>Personalised matches ranked by semantic AI score</p>
      </div>

      {!resumeId && (
        <div style={{ background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 12, padding: '1rem 1.2rem', marginBottom: '1.5rem', color: 'var(--amber)', fontSize: '.875rem' }}>
          ⚠️ No resume found. <button onClick={() => router.push('/candidate/upload')} style={{ background: 'none', border: 'none', color: 'var(--violet)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', fontSize: '.875rem' }}>Upload first →</button>
        </div>
      )}

      {/* Filter row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 360 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-d)', fontSize: '.9rem', pointerEvents: 'none' }}>🔍</span>
          <input className="field-input" style={{ paddingLeft: 36 }} placeholder="Search roles, companies…"
            value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {[['all','All'],['excellent','Excellent 80%+'],['strong','Strong 65%+'],['other','Partial']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            style={{ padding: '7px 14px', borderRadius: 99, border: `1px solid ${filter === v ? 'var(--violet)' : 'var(--border)'}`, background: filter === v ? 'var(--vd)' : 'none', color: filter === v ? 'var(--violet)' : 'var(--text-m)', fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font-b)' }}>
            {l}
          </button>
        ))}
      </div>

      {loading && <Spinner message="🔍 Finding best job matches…" sub="Running recommendations engine" />}
      {err && <div style={{ background: 'var(--rose-dim)', border: '1px solid rgba(244,63,94,.25)', borderRadius: 12, padding: '1rem', color: 'var(--rose)', marginBottom: '1.5rem', fontSize: '.875rem' }}>⚠️ {err}</div>}

      {!loading && !err && filtered.length === 0 && jobs.length === 0 && resumeId && (
        <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: .3 }}>💼</div>
          <div style={{ fontFamily: 'var(--font-d)', fontWeight: 700, marginBottom: 6 }}>No jobs to match</div>
          <div style={{ color: 'var(--text-m)', fontSize: '.875rem', marginBottom: '1.5rem' }}>Post some jobs in the Recruiter dashboard first.</div>
          <button onClick={() => router.push('/recruiter/post-job')} className="btn-primary" style={{ padding: '10px 24px', borderRadius: 10, fontSize: '.875rem' }}>Post a Job →</button>
        </div>
      )}

      {/* Jobs grid */}
      {filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          {filtered.map((job, idx) => {
            const color = COLORS[idx % COLORS.length];
            const pct   = toInt(job.final_score);
            return (
              <div key={job.job_id} onClick={() => handleCardClick(job)}
                style={{ background: 'var(--surface)', border: `1px solid ${selected?.job_id === job.job_id ? 'var(--violet)' : 'var(--border)'}`, borderRadius: 20, padding: '1.4rem', cursor: 'pointer', transition: 'all .22s', position: 'relative', overflow: 'hidden' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 40px rgba(0,0,0,.4)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
              >
                {/* Bottom accent line */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,${color},var(--teal))` }} />
                {/* Rank */}
                <div style={{ position: 'absolute', top: 14, right: 14, background: `${color}18`, color, border: `1px solid ${color}30`, fontSize: '.68rem', fontWeight: 800, padding: '3px 9px', borderRadius: 99, fontFamily: 'var(--font-d)' }}>#{job.rank}</div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}18`, border: `1px solid ${color}25`, display: 'grid', placeItems: 'center', fontSize: '1.1rem', flexShrink: 0 }}>🏢</div>
                  <span style={{ fontSize: '.78rem', color: 'var(--text-m)', fontWeight: 600 }}>{job.company}</span>
                </div>

                <h3 style={{ fontFamily: 'var(--font-d)', fontSize: '.95rem', fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>{job.title}</h3>
                <p style={{ fontSize: '.79rem', color: 'var(--text-m)', lineHeight: 1.6, marginBottom: 12 }}>{job.summary}</p>

                {/* Skill chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                  {job.matched_skills.slice(0, 3).map(s => <span key={s} className="chip chip-green">{s}</span>)}
                  {job.missing_skills.slice(0, 2).map(s => <span key={s} className="chip chip-red">✗{s}</span>)}
                </div>

                {/* Score footer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: '.68rem', color: 'var(--text-m)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Match Score</div>
                    <div style={{ width: 90, height: 5, background: 'var(--surface3)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${color},${color}99)`, borderRadius: 99 }} />
                    </div>
                  </div>
                  <ScorePill score={job.final_score} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="card anim-fade-up" style={{ marginTop: '1rem', borderColor: 'var(--border-hi)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-d)', fontSize: '1.2rem', fontWeight: 800 }}>{selected.title}</h2>
              <div style={{ fontSize: '.85rem', color: 'var(--text-m)' }}>{selected.company} · {selected.location} · {selected.job_type}</div>
            </div>
            <button onClick={() => setSelected(null)} className="btn-ghost" style={{ padding: '7px 14px', borderRadius: 8, fontSize: '.8rem' }}>✕ Close</button>
          </div>

          {matchLoading && <Spinner message="Loading detailed match…" />}

          {matchResult && !matchLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <div className="sec-line">Score</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
                  <ScoreRing score={matchResult.scores.final_score} size={100} />
                  <div style={{ flex: 1 }}>
                    <ScoreBar label="Semantic"   value={toInt(matchResult.scores.semantic_score)}    variant="violet" />
                    <ScoreBar label="Keyword"    value={toInt(matchResult.scores.keyword_score)}     variant="teal"   />
                    <ScoreBar label="Experience" value={toInt(matchResult.scores.experience_score)}  variant="amber"  />
                  </div>
                </div>
              </div>
              <ExplainPanel ex={matchResult.explainability} />
            </div>
          )}

          {!matchResult && !matchLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <div className="sec-line">Quick Overview</div>
                <div style={{ fontSize: '.875rem', lineHeight: 1.7, color: 'var(--text-m)' }}>{selected.summary}</div>
              </div>
              <div>
                <div className="sec-line">Skill Match ({selected.skill_match_pct}%)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                  {selected.matched_skills.map(s => <span key={s} className="chip chip-green">✓{s}</span>)}
                  {selected.missing_skills.map(s => <span key={s} className="chip chip-red">✗{s}</span>)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
