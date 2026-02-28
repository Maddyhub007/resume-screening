'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { useListJobs, useListResumes, useRankCandidates } from '@/lib/hooks/useQueries';
import { toInt, getScoreMeta } from '@/lib/utils/scores';
import { StatCardSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';

const PIE_COLORS = ['#10b981','#3b82f6','#f59e0b','#f43f5e'];
const DARK_TOOLTIP = {
  contentStyle: { background: 'var(--surface2,#141420)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#eeeef8', fontSize: '.8rem' },
  cursor: { fill: 'rgba(255,255,255,.03)' },
};

export default function ReportsPage() {
  const [selectedJob, setSelectedJob] = useState('');

  const { data: jobsData, isLoading: jobsLoading } = useListJobs(1, 50);
  const { data: resumesData, isLoading: resumesLoading } = useListResumes(1, 100);
  const { data: rankData, isLoading: rankLoading } = useRankCandidates(selectedJob || null);

  const jobs = jobsData?.data ?? [];
  const totalResumes = resumesData?.total ?? 0;
  const candidates = rankData?.data ?? [];

  const avg = candidates.length
    ? candidates.reduce((s, c) => s + c.scores.final_score, 0) / candidates.length
    : 0;

  // Missing skills aggregation
  const skillCounts: Record<string, number> = {};
  candidates.forEach(c => c.explainability.missing_skills.forEach(s => { skillCounts[s] = (skillCounts[s] || 0) + 1; }));
  const topMissing = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, count]) => ({ name, count, pct: Math.round((count / candidates.length) * 100) }));

  // Score distribution for pie
  const dist = [
    { name: 'Excellent 80%+', value: candidates.filter(c => c.scores.final_score >= 0.8).length,                              color: '#10b981' },
    { name: 'Strong 65–79%',  value: candidates.filter(c => c.scores.final_score >= 0.65 && c.scores.final_score < 0.8).length, color: '#3b82f6' },
    { name: 'Moderate 50–64%',value: candidates.filter(c => c.scores.final_score >= 0.5 && c.scores.final_score < 0.65).length, color: '#f59e0b' },
    { name: 'Weak <50%',       value: candidates.filter(c => c.scores.final_score < 0.5).length,                              color: '#f43f5e' },
  ].filter(d => d.value > 0);

  const STATS = [
    { label: 'Resumes Uploaded', value: resumesLoading ? '…' : totalResumes, color: 'var(--violet)' },
    { label: 'Jobs Posted',       value: jobsLoading   ? '…' : jobs.length,  color: 'var(--teal)'   },
    { label: 'Avg Match Score',   value: candidates.length ? `${toInt(avg)}%` : '—', color: 'var(--amber)' },
    { label: 'Top Score',          value: candidates[0] ? `${toInt(candidates[0].scores.final_score)}%` : '—', color: '#10b981' },
  ];

  return (
    <div style={{ padding: '2.5rem', maxWidth: 1080 }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>
          <span style={{ color: 'var(--text-m)' }}>Recruiter</span><span style={{ color: 'var(--border-hi)' }}>›</span><span style={{ color: 'var(--tl)' }}>Reports</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: 6 }}>Recruitment <span className="grad-text">Reports</span></h1>
        <p style={{ color: 'var(--text2)', fontSize: '.9rem', marginBottom: '2rem' }}>Analytics from your screening pipeline</p>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
          {(resumesLoading || jobsLoading) ? Array.from({length:4}).map((_,i)=><StatCardSkeleton key={i}/>) : STATS.map(s => (
            <motion.div key={s.label} whileHover={{ y: -1 }}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.4rem', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-40%', right: '-10%', width: 80, height: 80, borderRadius: '50%', background: s.color, opacity: .07 }} />
              <div style={{ fontSize: '.68rem', fontWeight: 800, color: 'var(--text-m)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 10 }}>{s.label}</div>
              <div style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            </motion.div>
          ))}
        </div>

        {/* Job selector */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="sec-line">Select Job for Detailed Analytics</div>
          <select className="field-input" style={{ maxWidth: 380, cursor: 'pointer' }}
            value={selectedJob} onChange={e => setSelectedJob(e.target.value)}>
            <option value="">-- Choose a job --</option>
            {jobs.map(j => <option key={j.job_id} value={j.job_id}>{j.title} @ {j.company}</option>)}
          </select>
        </div>

        {rankLoading && selectedJob && <div style={{ color: 'var(--text-m)', fontSize: '.875rem', padding: '2rem 0' }}>Loading analytics…</div>}

        {!selectedJob && <EmptyState icon="📈" title="Select a job above" message="Choose a job to see detailed candidate analytics, score distribution, and skill gaps." />}

        {candidates.length > 0 && !rankLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Top missing skills bar chart */}
            <div className="card">
              <div className="sec-line">Top Missing Skills</div>
              {topMissing.length === 0 ? <div style={{ color: 'var(--text-d)', fontSize: '.875rem' }}>No skill gaps found</div> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={topMissing} layout="vertical" margin={{ top: 0, right: 20, left: 60, bottom: 0 }}>
                    <XAxis type="number" tick={{ fill: '#5a5a7a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#9898b8', fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                    <Tooltip {...DARK_TOOLTIP} formatter={(v: number) => [`${v} candidates`, 'Missing']} />
                    <Bar dataKey="count" fill="#f43f5e" radius={[0,6,6,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Score distribution pie */}
            <div className="card">
              <div className="sec-line">Score Distribution ({candidates.length} candidates)</div>
              {dist.length === 0 ? <div style={{ color: 'var(--text-d)', fontSize: '.875rem' }}>No data</div> : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={dist} cx="50%" cy="45%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                      {dist.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip {...DARK_TOOLTIP} formatter={(v: number) => [`${v} candidates`]} />
                    <Legend formatter={(v) => <span style={{ color: '#9898b8', fontSize: '11px' }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Leaderboard */}
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <div className="sec-line">Top Candidates Leaderboard</div>
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr><th>Rank</th><th>Name</th><th>Final Score</th><th>Semantic</th><th>Skill Match</th><th>Assessment</th></tr>
                  </thead>
                  <tbody>
                    {candidates.slice(0, 8).map(c => {
                      const meta = getScoreMeta(c.scores.final_score);
                      return (
                        <tr key={c.resume_id}>
                          <td><div style={{ width: 28, height: 28, borderRadius: 8, background: c.rank <= 3 ? 'var(--amber)' : 'var(--surface3)', color: c.rank <= 3 ? '#000' : 'var(--text-m)', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-d)', fontSize: '.8rem', fontWeight: 800 }}>#{c.rank}</div></td>
                          <td><span style={{ fontWeight: 600 }}>{c.name}</span></td>
                          <td><span style={{ fontFamily: 'var(--font-d)', fontWeight: 800, padding: '4px 12px', borderRadius: 99, fontSize: '.82rem', background: `${meta.cssVar}18`, border: `1px solid ${meta.cssVar}40`, color: meta.cssVar }}>{toInt(c.scores.final_score)}%</span></td>
                          <td><span style={{ fontSize: '.78rem', color: 'var(--violet)', fontWeight: 700 }}>{toInt(c.scores.semantic_score)}%</span></td>
                          <td><span style={{ fontSize: '.78rem', color: 'var(--teal)', fontWeight: 700 }}>{c.explainability.skill_match_pct}%</span></td>
                          <td><span style={{ fontSize: '.78rem', color: meta.cssVar, fontWeight: 600 }}>{meta.emoji} {meta.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
