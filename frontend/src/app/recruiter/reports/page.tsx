'use client';
// src/app/recruiter/reports/page.tsx
// Analytics dashboard — pulls data from rankCandidates + listJobs.

import { useState, useEffect } from 'react';
import { rankCandidates, listJobs } from '@/lib/api';
import { toInt } from '@/lib/utils';
import type { RankedCandidate, JobData } from '@/types';
import Spinner from '@/components/ui/Spinner';

function StatCard({ label, value, sub, color, icon }: { label:string; value:string; sub:string; color:string; icon:string }) {
  return (
    <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-40%', right: '-15%', width: 80, height: 80, borderRadius: '50%', background: color, opacity: .08, pointerEvents: 'none' }} />
      <div style={{ fontSize: '.68rem', fontWeight: 800, color: 'var(--text-m)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{icon}</span>{label}
      </div>
      <div style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-.03em', marginBottom: 4, color }}>{value}</div>
      <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--text-m)' }}>{sub}</div>
    </div>
  );
}

function HBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <span style={{ width: 70, fontSize: '.75rem', color: 'var(--text-m)', fontWeight: 600, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 28, background: 'var(--surface2)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 8, display: 'flex', alignItems: 'center', paddingLeft: 10, transition: 'width 1s ease', minWidth: count > 0 ? 40 : 0 }}>
          {count > 0 && <span style={{ fontSize: '.72rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{count}</span>}
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [jobs, setJobs]             = useState<JobData[]>([]);
  const [candidates, setCandidates] = useState<RankedCandidate[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedJobId, setSelectedJobId] = useState('');

  useEffect(() => {
    listJobs(1, 50).then(res => {
      if (res.data.success && res.data.data.length > 0) {
        setJobs(res.data.data);
        const first = res.data.data[0].job_id;
        setSelectedJobId(first);
        return rankCandidates(first, 50);
      }
    }).then(res => {
      if (res?.data.success) setCandidates(res.data.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleJobChange = (jobId: string) => {
    setSelectedJobId(jobId); setCandidates([]);
    setLoading(true);
    rankCandidates(jobId, 50)
      .then(res => { if (res.data.success) setCandidates(res.data.data); })
      .catch(() => {}).finally(() => setLoading(false));
  };

  // Computed stats
  const total     = candidates.length;
  const avgScore  = total > 0 ? candidates.reduce((s, c) => s + c.scores.final_score, 0) / total : 0;
  const excellent = candidates.filter(c => c.scores.final_score >= 0.8).length;
  const strong    = candidates.filter(c => c.scores.final_score >= 0.65 && c.scores.final_score < 0.8).length;
  const moderate  = candidates.filter(c => c.scores.final_score >= 0.5  && c.scores.final_score < 0.65).length;
  const weak      = candidates.filter(c => c.scores.final_score < 0.5).length;

  // Missing skills frequency
  const skillFreq: Record<string, number> = {};
  candidates.forEach(c => c.explainability.missing_skills.forEach(s => { skillFreq[s] = (skillFreq[s] || 0) + 1; }));
  const topMissing = Object.entries(skillFreq).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="anim-fade-up" style={{ padding: '2.5rem', maxWidth: 1080 }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>
          <span style={{ color: 'var(--text-m)' }}>Recruiter</span>
          <span style={{ color: 'var(--border-hi)' }}>›</span>
          <span style={{ color: 'var(--tl)' }}>Reports</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: 6 }}>
              Recruitment <span className="grad-text">Reports</span>
            </h1>
            <p style={{ color: 'var(--text2)', fontSize: '.9rem' }}>Analytics and insights from your screening pipeline</p>
          </div>
          {jobs.length > 0 && (
            <select className="field-input" style={{ maxWidth: 340, cursor: 'pointer' }} value={selectedJobId} onChange={e => handleJobChange(e.target.value)}>
              {jobs.map(j => <option key={j.job_id} value={j.job_id} style={{ background: 'var(--surface2)' }}>{j.title} @ {j.company}</option>)}
            </select>
          )}
        </div>
      </div>

      {loading && <Spinner message="📊 Loading analytics…" sub="Fetching candidate scores" />}

      {!loading && jobs.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: .3 }}>📈</div>
          <div style={{ fontFamily: 'var(--font-d)', fontWeight: 700, marginBottom: 6 }}>No data yet</div>
          <div style={{ color: 'var(--text-m)', fontSize: '.875rem' }}>Post a job and upload resumes to see analytics.</div>
        </div>
      )}

      {!loading && total >= 0 && jobs.length > 0 && (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
            <StatCard label="Candidates"   value={String(total)}             sub="screened for this job"    color="var(--violet)" icon="👥" />
            <StatCard label="Avg Score"    value={`${toInt(avgScore)}%`}     sub="average AI match score"   color="var(--teal)"   icon="🎯" />
            <StatCard label="Excellent"    value={String(excellent)}          sub="score 80%+ (top tier)"   color="var(--teal)"   icon="🟢" />
            <StatCard label="Skill Gaps"   value={String(topMissing.length)} sub="unique missing skills"    color="var(--rose)"   icon="⚠️" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.75rem', marginBottom: '1.75rem' }}>
            {/* Score distribution */}
            <div className="card">
              <div className="sec-line">Score Distribution</div>
              <HBar label="Excellent 80%+" count={excellent} max={total} color="linear-gradient(90deg,var(--teal),var(--tl))" />
              <HBar label="Strong 65%+"    count={strong}    max={total} color="linear-gradient(90deg,var(--violet),var(--vl))" />
              <HBar label="Moderate 50%+"  count={moderate}  max={total} color="linear-gradient(90deg,var(--amber),#fcd34d)" />
              <HBar label="Weak &lt;50%"   count={weak}      max={total} color="linear-gradient(90deg,var(--rose),#fb7185)" />
              {total === 0 && <div style={{ color: 'var(--text-d)', fontSize: '.875rem', textAlign: 'center', padding: '2rem' }}>No candidates ranked yet</div>}
            </div>

            {/* Top missing skills */}
            <div className="card">
              <div className="sec-line">Top Missing Skills</div>
              {topMissing.length > 0 ? (
                topMissing.map(([skill, count]) => (
                  <HBar key={skill} label={skill} count={count} max={topMissing[0][1]} color="linear-gradient(90deg,var(--rose),#fb7185)" />
                ))
              ) : (
                <div style={{ color: 'var(--text-d)', fontSize: '.875rem', textAlign: 'center', padding: '2rem' }}>
                  {total === 0 ? 'No candidates ranked yet' : '🎉 No significant skill gaps!'}
                </div>
              )}
            </div>
          </div>

          {/* Top candidates leaderboard */}
          {candidates.length > 0 && (
            <div className="card">
              <div className="sec-line">🏆 Top Candidates</div>
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
                      <th>Matched Skills</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.slice(0, 10).map(c => {
                      const pct = toInt(c.scores.final_score);
                      const pillCls = pct >= 80 ? 'pill-green' : pct >= 65 ? 'pill-yellow' : pct >= 50 ? 'pill-orange' : 'pill-red';
                      const rankBg  = c.rank === 1 ? '#f59e0b' : c.rank === 2 ? '#9ca3af' : c.rank === 3 ? '#b45309' : 'var(--surface3)';
                      const rankFg  = c.rank <= 3 ? '#000' : 'var(--text-m)';
                      return (
                        <tr key={c.resume_id}>
                          <td><div style={{ width: 28, height: 28, borderRadius: 8, background: rankBg, color: rankFg, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-d)', fontSize: '.8rem', fontWeight: 800 }}>#{c.rank}</div></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,var(--violet),var(--teal))', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '.75rem', color: '#fff', flexShrink: 0 }}>
                                {c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '.875rem' }}>{c.name}</div>
                                <div style={{ fontSize: '.72rem', color: 'var(--text-m)' }}>{c.email}</div>
                              </div>
                            </div>
                          </td>
                          <td><span style={{ fontFamily: 'var(--font-d)', fontWeight: 700, fontSize: '.82rem', color: 'var(--violet)' }}>{toInt(c.scores.semantic_score)}%</span></td>
                          <td><span style={{ fontFamily: 'var(--font-d)', fontWeight: 700, fontSize: '.82rem', color: 'var(--teal)' }}>{toInt(c.scores.keyword_score)}%</span></td>
                          <td><span style={{ fontFamily: 'var(--font-d)', fontWeight: 700, fontSize: '.82rem', color: 'var(--amber)' }}>{toInt(c.scores.experience_score)}%</span></td>
                          <td><span className={`pill ${pillCls}`}>{pct}%</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {c.explainability.matched_skills.slice(0, 3).map(s => (
                                <span key={s} className="chip chip-green" style={{ fontSize: '.68rem' }}>{s}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
