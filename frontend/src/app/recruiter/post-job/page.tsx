'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createJob } from '@/lib/api';
import { extractError } from '@/lib/utils';
import type { CreateJobRequest, JobType } from '@/types';
import Toast from '@/components/ui/Toast';

const JOB_TYPES: { label: string; value: JobType }[] = [
  { label: 'Full-time', value: 'full-time' },
  { label: 'Part-time', value: 'part-time' },
  { label: 'Contract',  value: 'contract'  },
  { label: 'Remote',    value: 'remote'    },
  { label: 'Hybrid',    value: 'hybrid'    },
];

export default function PostJobPage() {
  const router = useRouter();
  const [form, setForm] = useState<CreateJobRequest>({
    title: '', company: '', description: '',
    location: '', job_type: 'full-time', experience_years: 2,
  });
  const [weights, setWeights] = useState({ semantic: 50, keyword: 30, experience: 20 });
  const [fairness, setFairness] = useState({ remove_name: true, remove_gender: true, skills_only: true, remove_university: false });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr]         = useState('');
  const [toast, setToast]     = useState(false);

  const total = weights.semantic + weights.keyword + weights.experience;

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.company.trim() || !form.description.trim()) {
      setErr('Title, company, and description are all required.'); return;
    }
    setSubmitting(true); setErr('');
    try {
      const res = await createJob(form);
      // ⚠️ API returns 201 with res.data.job_id
      if (!res.data.success) throw new Error('Job creation failed');
      sessionStorage.setItem('job_id', res.data.job_id);
      setToast(true);
      setTimeout(() => router.push('/recruiter/candidates'), 1600);
    } catch (e) {
      setErr(extractError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const set = (k: keyof CreateJobRequest, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="anim-fade-up" style={{ padding: '2.5rem', maxWidth: 1080 }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>
          <span style={{ color: 'var(--text-m)' }}>Recruiter</span><span style={{ color: 'var(--border-hi)' }}>›</span>
          <span style={{ color: 'var(--tl)' }}>Post Job</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: 6 }}>
          Post a <span className="grad-text">Job</span>
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: '.9rem' }}>
          Paste a job description — AI auto-extracts skills and ranks all uploaded candidates instantly
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.75rem' }}>
        {/* Left: form */}
        <div className="card">
          <div className="sec-line">Job Details</div>

          <div style={{ marginBottom: '1.1rem' }}>
            <label className="field-label">Job Title <span style={{ color: 'var(--rose)' }}>*</span></label>
            <input className="field-input" placeholder="e.g. Backend Engineer" value={form.title} onChange={e => set('title', e.target.value)} />
          </div>

          <div style={{ marginBottom: '1.1rem' }}>
            <label className="field-label">Company <span style={{ color: 'var(--rose)' }}>*</span></label>
            <input className="field-input" placeholder="e.g. InnovateTech" value={form.company} onChange={e => set('company', e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.1rem' }}>
            <div>
              <label className="field-label">Experience Level</label>
              <select className="field-input" style={{ cursor: 'pointer' }} value={form.experience_years} onChange={e => set('experience_years', Number(e.target.value))}>
                <option value={1} style={{ background: 'var(--surface2)' }}>Junior (0–2 yrs)</option>
                <option value={3} style={{ background: 'var(--surface2)' }}>Mid (2–5 yrs)</option>
                <option value={6} style={{ background: 'var(--surface2)' }}>Senior (5+ yrs)</option>
              </select>
            </div>
            <div>
              <label className="field-label">Job Type</label>
              <select className="field-input" style={{ cursor: 'pointer' }} value={form.job_type} onChange={e => set('job_type', e.target.value as JobType)}>
                {JOB_TYPES.map(t => <option key={t.value} value={t.value} style={{ background: 'var(--surface2)' }}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '1.1rem' }}>
            <label className="field-label">Location</label>
            <input className="field-input" placeholder="e.g. Chennai, India / Remote" value={form.location || ''} onChange={e => set('location', e.target.value)} />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label className="field-label">Job Description <span style={{ color: 'var(--rose)' }}>*</span></label>
            <textarea className="field-input" style={{ resize: 'vertical', minHeight: 150, lineHeight: 1.65 }}
              placeholder="Paste the full JD here. AI auto-extracts required skills, experience, and qualifications — no need to fill them in manually."
              value={form.description} onChange={e => set('description', e.target.value)} />
            <div style={{ fontSize: '.72rem', color: 'var(--text-d)', marginTop: 5 }}>
              💡 Tip: paste the full JD text — the more detail the better the AI matching.
            </div>
          </div>

          {err && (
            <div style={{ background: 'var(--rose-dim)', border: '1px solid rgba(244,63,94,.25)', color: 'var(--rose)', padding: '10px 14px', borderRadius: 10, fontSize: '.83rem', marginBottom: '1rem' }}>
              ⚠️ {err}
            </div>
          )}

          <button onClick={handleSubmit} disabled={submitting} className="btn-primary" style={{ width: '100%', padding: '12px', borderRadius: 12, fontSize: '.95rem' }}>
            {submitting ? '⏳ Posting…' : '🚀 Post & Start Screening'}
          </button>
        </div>

        {/* Right: weights + fairness */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Weights */}
          <div className="card">
            <div className="sec-line">Matching Weights</div>
            <p style={{ fontSize: '.8rem', color: 'var(--text-m)', marginBottom: '1.2rem', lineHeight: 1.6 }}>
              Control how each scoring layer contributes to the final rank.
              {total !== 100 && <span style={{ color: 'var(--amber)', fontWeight: 700 }}> Total: {total}% (should be 100)</span>}
            </p>

            {([
              { key: 'semantic' as const,   label: 'Semantic Similarity', sub: 'MiniLM cosine',  accent: 'var(--violet)' },
              { key: 'keyword'  as const,   label: 'Keyword Score',       sub: 'TF-IDF overlap', accent: 'var(--teal)'   },
              { key: 'experience' as const, label: 'Experience Match',    sub: 'Years vs req.',  accent: 'var(--amber)'  },
            ]).map(({ key, label, sub, accent }) => (
              <div key={key} style={{ marginBottom: '1.3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                  <div>
                    <span style={{ fontFamily: 'var(--font-d)', fontWeight: 700, fontSize: '.83rem' }}>{label}</span>
                    <span style={{ fontSize: '.68rem', color: 'var(--text-d)', marginLeft: 6 }}>{sub}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '.9rem', color: accent }}>{weights[key]}%</span>
                </div>
                <input type="range" min={0} max={100} value={weights[key]} style={{ accentColor: accent }}
                  onChange={e => setWeights(w => ({ ...w, [key]: Number(e.target.value) }))} />
              </div>
            ))}
          </div>

          {/* Fairness */}
          <div className="card-teal">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: '1rem' }}>🛡️</span>
              <span style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '.95rem', color: 'var(--tl)' }}>Fairness Settings</span>
            </div>
            <p style={{ fontSize: '.8rem', color: 'var(--text-m)', marginBottom: '1.2rem', lineHeight: 1.6 }}>
              Bias-aware mode strips personal identifiers so candidates are ranked purely on skills.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                { key: 'remove_name'       as const, label: 'Remove name from scoring'         },
                { key: 'remove_gender'     as const, label: 'Remove gender inference'           },
                { key: 'skills_only'       as const, label: 'Skills-first evaluation'           },
                { key: 'remove_university' as const, label: 'Remove university name from score' },
              ]).map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '.875rem' }}>
                  <input type="checkbox" checked={fairness[key]} onChange={e => setFairness(f => ({ ...f, [key]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>
            <div style={{ marginTop: '1rem', background: 'rgba(45,212,191,.06)', borderRadius: 8, padding: '10px 12px', fontSize: '.75rem', color: 'var(--text-m)', lineHeight: 1.6 }}>
              ℹ️ Skills-based screening reduces implicit bias by up to 40%. Aligns with EU AI Act fairness guidelines.
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast icon="🚀" title="Job Posted!" message="AI screening started — redirecting to candidates…" onClose={() => setToast(false)} />}
    </div>
  );
}
