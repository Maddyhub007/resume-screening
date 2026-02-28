'use client';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { useCreateJob } from '@/lib/hooks/useQueries';
import type { JobType } from '@/types';

// Zod schema — matches API requirements
const schema = z.object({
  title:            z.string().min(2, 'Title is required'),
  company:          z.string().min(2, 'Company is required'),
  description:      z.string().min(20, 'Please provide a detailed job description (min 20 chars)'),
  location:         z.string().optional(),
  job_type:         z.enum(['full-time','part-time','contract','remote','hybrid']).default('full-time'),
  experience_years: z.number().int().min(0).max(20).default(2),
});

type FormValues = z.infer<typeof schema>;

const JOB_TYPES: { label: string; value: JobType }[] = [
  { label: 'Full-time', value: 'full-time' },
  { label: 'Part-time', value: 'part-time' },
  { label: 'Contract',  value: 'contract'  },
  { label: 'Remote',    value: 'remote'    },
  { label: 'Hybrid',    value: 'hybrid'    },
];

export default function PostJobPage() {
  const router = useRouter();
  const { mutate: createJob, isPending } = useCreateJob();

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { job_type: 'full-time', experience_years: 2 },
  });

  const onSubmit = (values: FormValues) => {
    createJob(values, {
      onSuccess: () => setTimeout(() => router.push('/recruiter/candidates'), 1200),
    });
  };

  return (
    <div style={{ padding: '2.5rem', maxWidth: 1080 }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>
          <span style={{ color: 'var(--text-m)' }}>Recruiter</span><span style={{ color: 'var(--border-hi)' }}>›</span><span style={{ color: 'var(--tl)' }}>Post Job</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: 6 }}>Post a <span className="grad-text">Job</span></h1>
        <p style={{ color: 'var(--text2)', fontSize: '.9rem', marginBottom: '2rem' }}>Paste a JD — AI auto-extracts skills and ranks all candidates instantly</p>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.75rem' }}>
            {/* Left: job form */}
            <div className="card">
              <div className="sec-line">Job Details</div>

              <div style={{ marginBottom: '1.1rem' }}>
                <label className="field-label">Job Title <span style={{ color: 'var(--rose)' }}>*</span></label>
                <input className="field-input" placeholder="e.g. Backend Engineer" {...register('title')} />
                {errors.title && <div style={{ fontSize: '.72rem', color: 'var(--rose)', marginTop: 4 }}>{errors.title.message}</div>}
              </div>

              <div style={{ marginBottom: '1.1rem' }}>
                <label className="field-label">Company <span style={{ color: 'var(--rose)' }}>*</span></label>
                <input className="field-input" placeholder="e.g. InnovateTech" {...register('company')} />
                {errors.company && <div style={{ fontSize: '.72rem', color: 'var(--rose)', marginTop: 4 }}>{errors.company.message}</div>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.1rem' }}>
                <div>
                  <label className="field-label">Experience Level</label>
                  <select className="field-input" style={{ cursor: 'pointer' }} {...register('experience_years', { valueAsNumber: true })}>
                    <option value={1}>Junior (0–2 yrs)</option>
                    <option value={3}>Mid (2–5 yrs)</option>
                    <option value={6}>Senior (5+ yrs)</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Job Type</label>
                  <select className="field-input" style={{ cursor: 'pointer' }} {...register('job_type')}>
                    {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1.1rem' }}>
                <label className="field-label">Location</label>
                <input className="field-input" placeholder="e.g. Chennai, India / Remote" {...register('location')} />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label className="field-label">Job Description <span style={{ color: 'var(--rose)' }}>*</span></label>
                <textarea className="field-input" style={{ resize: 'vertical', minHeight: 150, lineHeight: 1.65 }}
                  placeholder="Paste the full JD here. AI auto-extracts required skills, experience, and qualifications."
                  {...register('description')} />
                {errors.description && <div style={{ fontSize: '.72rem', color: 'var(--rose)', marginTop: 4 }}>{errors.description.message}</div>}
                <div style={{ fontSize: '.72rem', color: 'var(--text-d)', marginTop: 5 }}>💡 The more detail you provide, the better the AI matching.</div>
              </div>

              <motion.button type="submit" disabled={isPending} whileHover={{ y: isPending ? 0 : -1 }} whileTap={{ scale: isPending ? 1 : .98 }}
                className="btn-primary" style={{ width: '100%', padding: '12px', borderRadius: 12, fontSize: '.95rem' }}>
                {isPending ? '⏳ Posting…' : '🚀 Post & Start Screening'}
              </motion.button>
            </div>

            {/* Right: info cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* How it works */}
              <div className="card">
                <div className="sec-line">How AI Matching Works</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {[
                    { icon: '🧬', title: 'Semantic Layer', desc: 'MiniLM embeds both JD and resumes, computes cosine similarity' },
                    { icon: '🔍', title: 'Keyword Layer',  desc: 'TF-IDF extracts required skills, checks overlap' },
                    { icon: '📅', title: 'Experience Layer', desc: 'Candidate years vs required years — weighted score' },
                  ].map(item => (
                    <div key={item.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--vd)', border: '1px solid rgba(124,106,247,.2)', display: 'grid', placeItems: 'center', fontSize: '.9rem', flexShrink: 0 }}>{item.icon}</div>
                      <div>
                        <div style={{ fontFamily: 'var(--font-d)', fontWeight: 700, fontSize: '.85rem', marginBottom: 3 }}>{item.title}</div>
                        <div style={{ fontSize: '.78rem', color: 'var(--text-m)', lineHeight: 1.5 }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fairness card */}
              <div className="card-teal">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span>🛡️</span>
                  <span style={{ fontFamily: 'var(--font-d)', fontWeight: 800, color: 'var(--tl)' }}>Bias-Aware Scoring</span>
                </div>
                <p style={{ fontSize: '.82rem', color: 'var(--text-m)', lineHeight: 1.65 }}>
                  Candidates are ranked on skills, semantic match, and experience — not name, university prestige, or location. Aligns with EU AI Act fairness guidelines.
                </p>
              </div>

              {/* Tips */}
              <div className="card">
                <div className="sec-line">Tips for Better Matches</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    'Include specific tools and frameworks (e.g. FastAPI, not just Python)',
                    'Mention must-have vs nice-to-have skills explicitly',
                    'State years of experience clearly in the JD text',
                    'Copy the full JD — more text = better semantic understanding',
                  ].map((tip, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, fontSize: '.8rem', color: 'var(--text-m)', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--teal)', fontWeight: 800, flexShrink: 0 }}>→</span> {tip}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
