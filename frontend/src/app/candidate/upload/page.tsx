'use client';
import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { parseResume } from '@/lib/api';
import { validateResumeFile, formatFileSize, extractError } from '@/lib/utils';
import type { ParsedResume } from '@/types';
import Toast from '@/components/ui/Toast';

const STEPS = ['Upload', 'Parse', 'Review', 'Match'];

export default function UploadPage() {
  const router  = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile]         = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus]     = useState<'idle' | 'parsing' | 'done' | 'error'>('idle');
  const [parsed, setParsed]     = useState<ParsedResume | null>(null);
  const [err, setErr]           = useState('');
  const [toast, setToast]       = useState(false);

  const step = status === 'idle' ? 0 : status === 'parsing' ? 1 : status === 'done' ? 2 : 0;

  const pickFile = useCallback((f: File) => {
    const e = validateResumeFile(f);
    if (e) { setErr(e); setStatus('error'); return; }
    setFile(f); setStatus('idle'); setErr(''); setParsed(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) pickFile(f);
  }, [pickFile]);

  const handleParse = async () => {
    if (!file) return;
    setStatus('parsing'); setErr('');
    try {
      const res = await parseResume(file);
      // ⚠️ API: resume_id is at res.data.resume_id, parsed object at res.data.data
      if (!res.data.success) throw new Error('Parse failed');
      const data = res.data.data;
      setParsed(data);
      setStatus('done');
      setToast(true);
      // Store for subsequent pages
      sessionStorage.setItem('resume_id', res.data.resume_id);
      sessionStorage.setItem('parsed_resume', JSON.stringify(data));
    } catch (e) {
      setErr(extractError(e));
      setStatus('error');
    }
  };

  return (
    <div className="anim-fade-up" style={{ padding: '2.5rem', maxWidth: 1080 }}>
      {/* Breadcrumb + title */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em' }}>
          <span style={{ color: 'var(--text-m)' }}>Candidate</span>
          <span style={{ color: 'var(--border-hi)' }}>›</span>
          <span style={{ color: 'var(--vl)' }}>Upload</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-.04em', marginBottom: 6 }}>
          Upload <span className="grad-text">Resume</span>
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: '.9rem' }}>
          AI extracts your skills, experience & education in seconds
        </p>
      </div>

      {/* Step wizard */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2.5rem' }}>
        {STEPS.map((s, i) => {
          const state = i < step ? 'done' : i === step ? 'active' : 'idle';
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div className={`step-circle ${state}`}>{state === 'done' ? '✓' : i + 1}</div>
                <span style={{ fontSize: '.65rem', fontWeight: 700, color: state === 'done' ? 'var(--teal)' : state === 'active' ? 'var(--text)' : 'var(--text-d)', whiteSpace: 'nowrap' }}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`step-line ${state === 'done' ? 'done' : state === 'active' ? 'active' : 'idle'}`} />}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.75rem' }}>
        {/* Left: upload zone */}
        <div>
          <div
            className={`upload-zone${dragging ? ' drag' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <div className="bg-grid" style={{ position: 'absolute', inset: 0, opacity: .3, pointerEvents: 'none' }} />
            <div className="anim-float" style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '1.2rem', filter: 'drop-shadow(0 4px 16px rgba(124,106,247,.4))' }}>📎</div>
              <div style={{ fontFamily: 'var(--font-d)', fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>
                {dragging ? 'Drop it here!' : 'Drop your resume here'}
              </div>
              <p style={{ color: 'var(--text-m)', fontSize: '.84rem', marginBottom: '1.5rem' }}>
                Drag & drop, or click to browse
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                {['PDF', 'DOCX'].map(t => (
                  <span key={t} style={{ background: 'var(--surface2)', border: '1px solid var(--border-hi)', color: 'var(--text-m)', fontSize: '.65rem', fontWeight: 800, letterSpacing: '.08em', padding: '3px 10px', borderRadius: 6 }}>{t}</span>
                ))}
              </div>
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.docx" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />

          {/* File selected row */}
          {file && status !== 'parsing' && (
            <div className="anim-fade-up" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--border-hi)', borderRadius: 14, padding: '1rem' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--vd)', border: '1px solid rgba(124,106,247,.2)', display: 'grid', placeItems: 'center', fontSize: '1.3rem', flexShrink: 0 }}>📄</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                <div style={{ fontSize: '.72rem', color: 'var(--text-m)', marginTop: 2 }}>{formatFileSize(file.size)}</div>
              </div>
              <span style={{ color: 'var(--teal)', fontSize: '1.1rem' }}>✓</span>
            </div>
          )}

          {file && status === 'idle' && (
            <button onClick={handleParse} className="btn-primary" style={{ width: '100%', marginTop: '.75rem', padding: '12px', borderRadius: 12, fontSize: '.95rem' }}>
              🚀 Parse with AI
            </button>
          )}

          {status === 'error' && (
            <div className="anim-fade-up" style={{ marginTop: '1rem', background: 'var(--rose-dim)', border: '1px solid rgba(244,63,94,.25)', borderRadius: 12, padding: '1rem 1.2rem', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--rose)', fontSize: '.85rem', marginBottom: 2 }}>Error</div>
                <div style={{ fontSize: '.8rem', color: 'var(--text-m)' }}>{err}</div>
              </div>
              <button onClick={() => setStatus('idle')} style={{ background: 'none', border: 'none', color: 'var(--text-d)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
            </div>
          )}

          {/* What the parser extracts */}
          <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['🏷️','Name & contact'],['⚡','Skills (normalised)'],['💼','Work experience'],['🎓','Education history']].map(([icon, text]) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: '.76rem', color: 'var(--text-m)' }}>
                <span>{icon}</span>{text}
              </div>
            ))}
          </div>
        </div>

        {/* Right: result pane */}
        <div>
          {status === 'parsing' && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 340 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--violet)', animation: 'spin .8s linear infinite', marginBottom: '1.5rem' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <div style={{ fontFamily: 'var(--font-d)', fontWeight: 700, marginBottom: 6 }}>🧠 AI Parsing Resume…</div>
              <div style={{ color: 'var(--text-m)', fontSize: '.82rem' }}>Extracting skills, experience & education</div>
            </div>
          )}

          {status === 'done' && parsed && (
            <div className="card anim-fade-up" style={{ borderColor: 'var(--border-hi)' }}>
              {/* Profile header */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: '1.4rem' }}>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: 'linear-gradient(135deg,var(--violet),var(--teal))', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '1.1rem', color: '#fff', flexShrink: 0, boxShadow: '0 4px 16px rgba(124,106,247,.35)' }}>
                  {parsed.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '1.05rem', marginBottom: 2 }}>{parsed.name}</div>
                  <div style={{ fontSize: '.78rem', color: 'var(--text-m)' }}>{parsed.email}</div>
                  {parsed.phone && <div style={{ fontSize: '.72rem', color: 'var(--text-d)', marginTop: 1 }}>{parsed.phone}</div>}
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <span style={{ background: 'var(--td)', border: '1px solid rgba(45,212,191,.25)', color: 'var(--teal)', padding: '4px 10px', borderRadius: 99, fontSize: '.68rem', fontWeight: 800 }}>
                    {parsed.total_experience_years}yr exp
                  </span>
                </div>
              </div>

              <div className="divider" />

              {/* Skills */}
              <div style={{ marginBottom: '1.2rem' }}>
                <div className="sec-line">Skills ({parsed.skills.length})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {parsed.skills.map(s => <span key={s} className="chip chip-blue">{s}</span>)}
                  {parsed.skills.length === 0 && <span style={{ fontSize: '.8rem', color: 'var(--text-d)' }}>No skills extracted</span>}
                </div>
              </div>

              {/* Experience */}
              {(parsed.experience?.length ?? 0) > 0 && (
                <div style={{ marginBottom: '1.2rem' }}>
                  <div className="sec-line">Experience</div>
                  {parsed.experience.map((ex, i) => (
                    <div key={i} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', borderLeft: '3px solid var(--violet)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '.85rem' }}>{ex.title}</div>
                        {ex.company && <div style={{ fontSize: '.75rem', color: 'var(--text-m)', marginTop: 1 }}>{ex.company}</div>}
                      </div>
                      <span style={{ fontSize: '.72rem', color: 'var(--text-d)', fontWeight: 700, marginLeft: 8 }}>{ex.years}yr</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Education */}
              {(parsed.education?.length ?? 0) > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div className="sec-line">Education</div>
                  {parsed.education.map((ed, i) => (
                    <div key={i} style={{ fontSize: '.85rem', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{ed.degree}</span>
                      <span style={{ color: 'var(--text-m)' }}> · {ed.institution}, {ed.year}</span>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => router.push('/candidate/results')} className="btn-primary" style={{ width: '100%', padding: '11px', borderRadius: 12, fontSize: '.92rem' }}>
                Find Matching Jobs →
              </button>
            </div>
          )}

          {status === 'idle' && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', opacity: .15, marginBottom: '1rem' }}>∑</div>
              <div style={{ fontFamily: 'var(--font-d)', fontWeight: 700, marginBottom: 6 }}>AI Parser Ready</div>
              <div style={{ fontSize: '.84rem', color: 'var(--text-m)', maxWidth: 200, lineHeight: 1.6 }}>Upload a resume to begin intelligent extraction</div>
            </div>
          )}
        </div>
      </div>

      {toast && <Toast icon="✅" title="Resume Parsed!" message={`${parsed?.skills.length ?? 0} skills and ${parsed?.experience?.length ?? 0} roles extracted`} onClose={() => setToast(false)} />}
    </div>
  );
}
