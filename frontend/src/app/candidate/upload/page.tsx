'use client';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useParseResume } from '@/lib/hooks/useQueries';
import { useAppStore } from '@/lib/store/appStore';
import { validateResumeFile, formatBytes } from '@/lib/utils/scores';

const STEPS = ['Upload', 'Parse', 'Review', 'Match'];

export default function UploadPage() {
  const router = useRouter();
  const { mutate: parse, isPending, isSuccess } = useParseResume();
  const parsedResume = useAppStore(s => s.parsedResume);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');

  const onDrop = useCallback((accepted: File[]) => {
    setFileError('');
    const f = accepted[0];
    if (!f) return;
    const err = validateResumeFile(f);
    if (err) { setFileError(err); return; }
    setFile(f);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
    maxFiles: 1,
    onDropRejected: () => setFileError('Only .pdf or .docx files are accepted.'),
  });

  const step = isPending ? 1 : isSuccess ? 2 : 0;

  return (
    <div style={{ padding: '2.5rem', maxWidth: 1080 }}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>
          <span style={{ color: 'var(--text-m)' }}>Candidate</span><span style={{ color: 'var(--border-hi)' }}>›</span>
          <span style={{ color: 'var(--vl)' }}>Upload</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: 6 }}>
          Upload <span className="grad-text">Resume</span>
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: '.9rem', marginBottom: '2rem' }}>AI extracts your skills, experience & education in seconds</p>

        {/* Step wizard */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2.5rem' }}>
          {STEPS.map((s, i) => {
            const state = i < step ? 'done' : i === step ? 'active' : 'idle';
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <motion.div
                    className={`step-circle ${state}`}
                    animate={{ scale: state === 'active' ? [1, 1.1, 1] : 1 }}
                    transition={{ duration: .6, repeat: state === 'active' ? Infinity : 0 }}
                  >{state === 'done' ? '✓' : i + 1}</motion.div>
                  <span style={{ fontSize: '.65rem', fontWeight: 700, color: state === 'done' ? 'var(--teal)' : state === 'active' ? 'var(--text)' : 'var(--text-d)', whiteSpace: 'nowrap' }}>{s}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`step-line ${state === 'done' ? 'done' : state === 'active' ? 'active' : 'idle'}`} />}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.75rem' }}>
          {/* Left: drop zone */}
          <div>
            <div
              {...getRootProps()}
              className={`upload-zone${isDragActive ? ' drag' : ''}`}
              style={{ cursor: 'pointer' }}
            >
              <input {...getInputProps()} />
              <div className="bg-grid" style={{ position: 'absolute', inset: 0, opacity: .3, pointerEvents: 'none' }} />
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '1.2rem', filter: 'drop-shadow(0 4px 16px rgba(124,106,247,.4))' }}>📎</div>
                <div style={{ fontFamily: 'var(--font-d)', fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>
                  {isDragActive ? 'Drop it here!' : 'Drop your resume here'}
                </div>
                <p style={{ color: 'var(--text-m)', fontSize: '.84rem', marginBottom: '1.5rem' }}>Drag & drop, or click to browse</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                  {['PDF', 'DOCX'].map(t => <span key={t} style={{ background: 'var(--surface2)', border: '1px solid var(--border-hi)', color: 'var(--text-m)', fontSize: '.65rem', fontWeight: 800, letterSpacing: '.08em', padding: '3px 10px', borderRadius: 6 }}>{t}</span>)}
                </div>
              </motion.div>
            </div>

            {/* File selected */}
            <AnimatePresence>
              {file && !isPending && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--border-hi)', borderRadius: 14, padding: '1rem' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--vd)', border: '1px solid rgba(124,106,247,.2)', display: 'grid', placeItems: 'center', fontSize: '1.3rem', flexShrink: 0 }}>📄</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                    <div style={{ fontSize: '.72rem', color: 'var(--text-m)', marginTop: 2 }}>{formatBytes(file.size)}</div>
                  </div>
                  <span style={{ color: 'var(--teal)', fontSize: '1.1rem' }}>✓</span>
                </motion.div>
              )}
            </AnimatePresence>

            {fileError && (
              <div style={{ marginTop: '.75rem', background: 'var(--rose-dim)', border: '1px solid rgba(244,63,94,.25)', borderRadius: 10, padding: '10px 14px', fontSize: '.82rem', color: 'var(--rose)' }}>
                ⚠️ {fileError}
              </div>
            )}

            {file && !isPending && !isSuccess && (
              <motion.button whileHover={{ y: -1 }} whileTap={{ scale: .98 }}
                onClick={() => parse(file)} className="btn-primary"
                style={{ width: '100%', marginTop: '.75rem', padding: '12px', borderRadius: 12, fontSize: '.95rem' }}>
                🚀 Parse with AI
              </motion.button>
            )}

            {isPending && (
              <div style={{ marginTop: '.75rem', background: 'var(--vd)', border: '1px solid rgba(124,106,247,.2)', borderRadius: 12, padding: '1rem', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'var(--violet)', animation: 'spin .8s linear infinite', flexShrink: 0 }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                <div style={{ fontSize: '.85rem', fontWeight: 600 }}>Parsing resume with AI…</div>
              </div>
            )}

            {/* What gets extracted */}
            <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['🏷️','Name & contact'],['⚡','Skills (normalised)'],['💼','Work experience'],['🎓','Education history']].map(([icon, text]) => (
                <div key={text as string} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: '.76rem', color: 'var(--text-m)' }}>
                  <span>{icon}</span>{text}
                </div>
              ))}
            </div>
          </div>

          {/* Right: result */}
          <div>
            {isPending && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 340 }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: .8, repeat: Infinity, ease: 'linear' }}
                  style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--violet)', marginBottom: '1.5rem' }} />
                <div style={{ fontFamily: 'var(--font-d)', fontWeight: 700, marginBottom: 6 }}>🧠 AI Parsing Resume…</div>
                <div style={{ color: 'var(--text-m)', fontSize: '.82rem' }}>Extracting skills, experience & education</div>
              </div>
            )}

            {isSuccess && parsedResume && (
              <motion.div initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .4 }}
                className="card" style={{ borderColor: 'var(--border-hi)' }}>
                {/* Profile header */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: '1.4rem' }}>
                  <div style={{ width: 50, height: 50, borderRadius: 14, background: 'linear-gradient(135deg,var(--violet),var(--teal))', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '1.1rem', color: '#fff', flexShrink: 0, boxShadow: '0 4px 16px rgba(124,106,247,.35)' }}>
                    {parsedResume.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '1.05rem', marginBottom: 2 }}>{parsedResume.name}</div>
                    <div style={{ fontSize: '.78rem', color: 'var(--text-m)' }}>{parsedResume.email}</div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <span style={{ background: 'var(--td)', border: '1px solid rgba(45,212,191,.25)', color: 'var(--teal)', padding: '4px 10px', borderRadius: 99, fontSize: '.68rem', fontWeight: 800 }}>
                      {parsedResume.total_experience_years}yr exp
                    </span>
                  </div>
                </div>
                <div className="divider" />
                {/* Skills */}
                <div style={{ marginBottom: '1.2rem' }}>
                  <div className="sec-line">Skills ({parsedResume.skills.length})</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {parsedResume.skills.map((s: string) => <span key={s} className="chip chip-blue">{s}</span>)}
                  </div>
                </div>
                {/* Experience */}
                {parsedResume.experience?.length > 0 && (
                  <div style={{ marginBottom: '1.2rem' }}>
                    <div className="sec-line">Experience</div>
                    {parsedResume.experience.map((ex: {title:string;company:string;years:number}, i: number) => (
                      <div key={i} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', borderLeft: '3px solid var(--violet)', display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '.85rem' }}>{ex.title}</div>
                          {ex.company && <div style={{ fontSize: '.75rem', color: 'var(--text-m)' }}>{ex.company}</div>}
                        </div>
                        <span style={{ fontSize: '.72rem', color: 'var(--text-d)', fontWeight: 700 }}>{ex.years}yr</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Education */}
                {parsedResume.education?.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div className="sec-line">Education</div>
                    {parsedResume.education.map((ed: {degree:string;institution:string;year:string}, i: number) => (
                      <div key={i} style={{ fontSize: '.85rem', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{ed.degree}</span>
                        <span style={{ color: 'var(--text-m)' }}> · {ed.institution}, {ed.year}</span>
                      </div>
                    ))}
                  </div>
                )}
                <motion.button whileHover={{ y: -1 }} whileTap={{ scale: .98 }}
                  onClick={() => router.push('/candidate/results')} className="btn-primary"
                  style={{ width: '100%', padding: '11px', borderRadius: 12, fontSize: '.92rem' }}>
                  Find Matching Jobs →
                </motion.button>
              </motion.div>
            )}

            {!isPending && !isSuccess && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', opacity: .15, marginBottom: '1rem' }}>∑</div>
                <div style={{ fontFamily: 'var(--font-d)', fontWeight: 700, marginBottom: 6 }}>AI Parser Ready</div>
                <div style={{ fontSize: '.84rem', color: 'var(--text-m)', maxWidth: 200, lineHeight: 1.6 }}>Upload a resume to begin intelligent extraction</div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
