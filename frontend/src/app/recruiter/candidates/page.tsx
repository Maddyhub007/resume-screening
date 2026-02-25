'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { rankCandidates, listJobs } from '@/lib/api';
import { toInt, getScoreLabel, extractError } from '@/lib/utils';
import type { RankedCandidate, JobData } from '@/types';
import Spinner from '@/components/ui/Spinner';

function RankBadge({ rank }: { rank: number }) {
  const bg = rank === 1 ? '#f59e0b' : rank === 2 ? '#9ca3af' : rank === 3 ? '#b45309' : 'var(--surface3)';
  const fg = rank <= 3 ? '#000' : 'var(--text-m)';
  return <div style={{ width: 28, height: 28, borderRadius: 8, background: bg, color: fg, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-d)', fontSize: '.8rem', fontWeight: 800 }}>#{rank}</div>;
}

export default function CandidatesPage() {
  const router = useRouter();
  const [jobs, setJobs]           = useState<JobData[]>([]);
  const [selectedJob, setSelected] = useState(() => typeof window !== 'undefined' ? sessionStorage.getItem('job_id') || '' : '');
  const [candidates, setCandidates] = useState<RankedCandidate[]>([]);
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState('');
  const [query, setQuery]         = useState('');
  const [sortBy, setSortBy]       = useState<'rank' | 'final' | 'semantic'>('rank');

  useEffect(() => {
    listJobs(1, 50).then(res => {
      if (res.data.success) setJobs(res.data.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedJob) return;
    setLoading(true); setErr('');
    rankCandidates(selectedJob, 20)
      .then(res => {
        // ⚠️ API: res.data.data is a FLAT ARRAY — res.data.data[0].rank
        if (res.data.success) setCandidates(res.data.data);
      })
      .catch(e => setErr(extractError(e)))
      .finally(() => setLoading(false));
  }, [selectedJob]);

  const handleJobChange = (jobId: string) => {
    setSelected(jobId);
    sessionStorage.setItem('job_id', jobId);
    setCandidates([]);
  };

  const sorted = [...candidates]
    .filter(c => !query || c.name.toLowerCase().includes(query.toLowerCase()) || c.email.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) =>
      sortBy === 'rank'     ? a.rank - b.rank :
      sortBy === 'final'    ? b.scores.final_score - a.scores.final_score :
                              b.scores.semantic_score - a.scores.semantic_score
    );

  const openAnalysis = (c: RankedCandidate) => {
    sessionStorage.setItem('selected_candidate', JSON.stringify(c));
    router.push('/recruiter/analysis');
  };

  return (
    <div className="anim-fade-up" style={{ padding: '2.5rem', maxWidth: 1080 }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>
          <span style={{ color: 'var(--text-m)' }}>Recruiter</span><span style={{ color: 'var(--border-hi)' }}>›</span>
          <span style={{ color: 'var(--tl)' }}>Rankings</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
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
      </div>

      {/* Job selector */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="sec-line">Select Job to Rank Candidates For</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="field-input" style={{ maxWidth: 380, cursor: 'pointer' }}
            value={selectedJob} onChange={e => handleJobChange(e.target.value)}>
            <option value="">-- Choose a job --</option>
            {jobs.map(j => <option key={j.job_id} value={j.job_id}>{j.title} @ {j.company}</option>)}
          </select>
          {candidates.length > 0 && (
            <span style={{ fontSize: '.8rem', color: 'var(--text-m)', fontWeight: 600 }}>
              {candidates.length} candidate{candidates.length !== 1 ? 's' : ''} ranked
            </span>
          )}
        </div>
      </div>

      {/* Filter + sort row */}
      {candidates.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 320 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-d)', pointerEvents: 'none' }}>🔍</span>
            <input className="field-input" style={{ paddingLeft: 36 }} placeholder="Search candidates…" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {([['rank','Rank'],['final','Final Score'],['semantic','Semantic']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setSortBy(v)}
                style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${sortBy === v ? 'var(--violet)' : 'var(--border)'}`, background: sortBy === v ? 'var(--vd)' : 'none', color: sortBy === v ? 'var(--violet)' : 'var(--text-m)', fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-b)' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <Spinner message="🏅 Ranking Candidates…" sub="Scoring all uploaded resumes against this job" />}
      {err && <div style={{ background: 'var(--rose-dim)', border: '1px solid rgba(244,63,94,.25)', borderRadius: 12, padding: '1rem', color: 'var(--rose)', marginBottom: '1.5rem', fontSize: '.875rem' }}>⚠️ {err}</div>}

      {!loading && selectedJob && candidates.length === 0 && !err && (
        <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: .3 }}>👥</div>
          <div style={{ fontFamily: 'var(--font-d)', fontWeight: 700, marginBottom: 6 }}>No candidates yet</div>
          <div style={{ color: 'var(--text-m)', fontSize: '.875rem' }}>Upload resumes via the Candidate dashboard first.</div>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Candidate</th>
                <th>Semantic</th>
                <th>Keyword</th>
                <th>Experience</th>
                <th>Final Score</th>
                <th>Skills</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => {
                const meta = getScoreLabel(c.scores.final_score);
                const pillCls = meta.color === 'green' ? 'pill-green' : meta.color === 'yellow' ? 'pill-yellow' : meta.color === 'orange' ? 'pill-orange' : 'pill-red';
                return (
                  <tr key={c.resume_id} onClick={() => openAnalysis(c)}>
                    <td><RankBadge rank={c.rank} /></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,var(--violet),var(--teal))', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '.8rem', color: '#fff', flexShrink: 0 }}>
                          {c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '.875rem' }}>{c.name}</div>
                          <div style={{ fontSize: '.72rem', color: 'var(--text-m)' }}>{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="score-track" style={{ width: 60 }}><div className="score-fill" style={{ width: `${toInt(c.scores.semantic_score)}%`, background: 'linear-gradient(90deg,var(--violet),var(--vl))' }} /></div>
                        <span style={{ fontSize: '.78rem', fontFamily: 'var(--font-d)', fontWeight: 700 }}>{toInt(c.scores.semantic_score)}%</span>
                      </div>
                    </td>
                    <td><span style={{ fontSize: '.78rem', fontFamily: 'var(--font-d)', fontWeight: 700, color: 'var(--teal)' }}>{toInt(c.scores.keyword_score)}%</span></td>
                    <td><span style={{ fontSize: '.78rem', fontFamily: 'var(--font-d)', fontWeight: 700, color: 'var(--amber)' }}>{toInt(c.scores.experience_score)}%</span></td>
                    <td><span className={`pill ${pillCls}`}>{toInt(c.scores.final_score)}%</span></td>
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
    </div>
  );
}
