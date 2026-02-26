'use client';
import Link from 'next/link';

const FEATURES = [
  { icon: '🧬', title: 'Semantic Matching',   desc: 'MiniLM sentence embeddings compute contextual similarity beyond keyword overlap.' },
  { icon: '🔍', title: 'Explainable AI',       desc: 'Every score includes matched skills, gaps, and a human-readable explanation.' },
  { icon: '⚖️', title: 'Bias-Aware Scoring',  desc: 'Names, gender, and university can be stripped — skills and experience only.' },
  { icon: '📊', title: '3-Layer Engine',        desc: 'TF-IDF keywords + semantic cosine + experience weight = final score.' },
];

export default function HomePage() {
  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      <div className="bg-grid" style={{ position: 'absolute', inset: 0, opacity: .35 }} />
      <div style={{ position: 'absolute', top: '8%', left: '18%', width: 600, height: 500, background: 'radial-gradient(circle, rgba(124,106,247,.1) 0%, transparent 65%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '10%', width: 400, height: 350, background: 'radial-gradient(circle, rgba(45,212,191,.07) 0%, transparent 65%)', pointerEvents: 'none' }} />

      {/* Hero */}
      <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '7rem 2rem 5rem', position: 'relative', zIndex: 1 }}>

        <h1 className="anim-fade-up s2" style={{ fontFamily: 'var(--font-d)', fontSize: 'clamp(2.8rem,6.5vw,5rem)', fontWeight: 800, letterSpacing: '-.045em', lineHeight: 1.02, marginBottom: '1.5rem' }}>
          Recruitment powered by<br /><span className="grad-text">Semantic Intelligence</span>
        </h1>

        <p className="anim-fade-up s3" style={{ color: 'var(--text2)', fontSize: '1.1rem', lineHeight: 1.75, maxWidth: 520, marginBottom: '3rem' }}>
          Three-layer hybrid AI matches candidates to jobs with full explainability — not just keyword overlap.
        </p>

        <div className="anim-fade-up s4" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '5rem' }}>
          <Link href="/candidate/upload" className="btn-primary" style={{ padding: '13px 30px', borderRadius: 12, fontSize: '.95rem', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Upload My Resume →
          </Link>
          <Link href="/recruiter/post-job" className="btn-secondary" style={{ padding: '13px 30px', borderRadius: 12, fontSize: '.95rem', display: 'inline-block' }}>
            Recruiter Dashboard
          </Link>
        </div>

        {/* Stats strip */}
        <div className="anim-fade-up" style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border-hi)', borderRadius: 16, overflow: 'hidden' }}>
          {[['MiniLM','Semantic Engine'],['TF-IDF','Keyword Layer'],['XAI','Explainability'],['Fair','Bias-Aware']].map(([val,sub], i) => (
            <div key={val} style={{ padding: '1.2rem 2rem', textAlign: 'center', borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
              <div className="grad-text" style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '1.25rem' }}>{val}</div>
              <div style={{ fontSize: '.72rem', color: 'var(--text-m)', marginTop: 2, fontWeight: 600 }}>{sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: 0, borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--border)', position: 'relative', zIndex: 1 }}>
        {FEATURES.map(f => (
          <div key={f.title} style={{ padding: '2.5rem 2rem', background: 'var(--bg-e)', transition: 'background .2s' }}
            onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)'}
            onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-e)'}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{f.icon}</div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
            <p style={{ fontSize: '.84rem', color: 'var(--text-m)', lineHeight: 1.65 }}>{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Bottom CTA */}
      <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5rem 2rem', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <h2 style={{ fontFamily: 'var(--font-d)', fontSize: '2rem', fontWeight: 800, marginBottom: '1rem', letterSpacing: '-.03em' }}>
          Ready to hire <span className="grad-text">intelligently</span>?
        </h2>
        <p style={{ color: 'var(--text-m)', fontSize: '.95rem', marginBottom: '2rem', maxWidth: 400 }}>
          Start screening resumes or find your perfect job match — powered by state-of-the-art NLP.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/candidate/upload" className="btn-primary" style={{ padding: '11px 26px', borderRadius: 10, fontSize: '.9rem', display: 'inline-block' }}>Try as Candidate</Link>
          <Link href="/recruiter/post-job" className="btn-secondary" style={{ padding: '11px 26px', borderRadius: 10, fontSize: '.9rem', display: 'inline-block' }}>Try as Recruiter</Link>
        </div>
      </section>
    </div>
  );
}
