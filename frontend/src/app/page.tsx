'use client';
import Link from 'next/link';
import { useState } from 'react';

const FEATURES = [
  {
    icon: '🧬',
    title: 'Semantic Matching',
    desc: 'Goes beyond keywords — our MiniLM model understands context, synonyms, and role intent to find true skill alignment.',
    tags: ['MiniLM', 'Cosine Similarity'],
    large: true,
  },
  {
    icon: '🎙️',
    title: 'Explainable AI',
    desc: 'Every score comes with a full breakdown — matched skills, gaps, and a plain-English summary you can actually act on.',
    tags: ['XAI', 'Score Breakdown'],
    large: true,
  },
  {
    icon: '⚖️',
    title: 'Bias-Aware Scoring',
    desc: 'Optionally strip names, gender signals, and university prestige. Rank candidates purely on what they can do.',
    tags: ['Fair Hiring', 'EU AI Act'],
  },
  {
    icon: '📊',
    title: '3-Layer Engine',
    desc: 'TF-IDF keyword overlap, semantic cosine score, and experience years — weighted and fused into one final rank.',
    tags: ['TF-IDF', 'Weighted Fusion'],
  },
  {
    icon: '🚀',
    title: 'Instant Rankings',
    desc: 'Upload a JD and get every candidate ranked in seconds — no manual shortlisting required.',
    tags: ['Rank Candidates', 'Batch Score'],
  },
];

const STEPS = [
  { num: '01', icon: '⚡', title: 'Upload Your Resume', desc: 'Drag and drop a PDF or DOCX. Our parser extracts skills, experience, and education automatically — no manual input.' },
  { num: '02', icon: '🛡️', title: 'AI Runs the Analysis', desc: 'Three scoring layers fire in parallel: semantic similarity, keyword overlap, and experience match. All in under 3 seconds.' },
  { num: '03', icon: '🎯', title: 'Get Matched & Hired', desc: 'See your ranked job matches, understand exactly where you fall short, and follow a personalised upskilling roadmap.' },
];

const TESTIMONIALS = [
  {
    text: "I sent 40 applications with zero responses. After seeing which skills were missing from my resume, I added them. Three interviews in the next week.",
    name: 'Arjun S.',
    role: 'Backend Developer',
    initials: 'AS',
    color: '#7c6af7',
  },
  {
    text: "The semantic matching is genuinely impressive. It ranked a candidate with no exact keyword matches as #1 — and she was the best hire we made this year.",
    name: 'Priya M.',
    role: 'Engineering Manager',
    initials: 'PM',
    color: '#2dd4bf',
  },
  {
    text: "Finally a tool that explains WHY. Not just a score, but which skills matched, which were missing, and what to learn next. This is what AI should do.",
    name: 'Rahul K.',
    role: 'Final-Year CS Student',
    initials: 'RK',
    color: '#f59e0b',
  },
];

const FAQS = [
  { q: 'How is this different from a keyword scanner?', a: 'Most ATS tools just count keyword matches. TalentAI uses sentence-transformer embeddings to understand meaning — so "built REST APIs" matches "backend development" even without exact words.' },
  { q: 'Is my resume data stored permanently?', a: 'The backend stores data in-memory during your session. It resets on restart. No data is persisted to a database or shared with third parties.' },
  { q: 'Does it work for non-technical roles?', a: 'Yes. The semantic model works across domains — marketing, design, operations, finance. It learns from the job description, not a fixed skill taxonomy.' },
];

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div style={{ background: '#05050f', color: '#e8e8f0', fontFamily: "'DM Sans', sans-serif", overflowX: 'hidden' }}>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden', padding: '0 7vw' }}>
        {/* Deep blue radial bg */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 60% 50%, rgba(20,30,80,.85) 0%, #05050f 70%)', pointerEvents: 'none' }} />
        {/* Grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)', backgroundSize: '56px 56px', pointerEvents: 'none' }} />
        {/* Glow blobs */}
        <div style={{ position: 'absolute', top: '15%', right: '8%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,106,247,.18) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: '5%', width: 350, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(45,212,191,.08) 0%, transparent 65%)', pointerEvents: 'none' }} />

      {/* Hero */}
      <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '7rem 2rem 5rem', position: 'relative', zIndex: 1 }}>
        <div className="anim-fade-up s1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(124,106,247,.08)', border: '1px solid rgba(124,106,247,.2)', color: 'var(--vl)', padding: '6px 18px', borderRadius: 99, marginBottom: '2rem', fontSize: '.75rem', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--vl)', display: 'inline-block', boxShadow: '0 0 8px var(--violet)' }} />
          Final-Year Engineering Project · AI + NLP + Semantic Search
        </div>

            <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 'clamp(2.6rem, 5vw, 4.2rem)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-.04em', marginBottom: '1.5rem' }}>
              Stop Losing Jobs<br />
              <span style={{ background: 'linear-gradient(135deg, #7c6af7 0%, #2dd4bf 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                to Bad Matching.
              </span>
            </h1>

            <p style={{ fontSize: '1.05rem', color: '#8888aa', lineHeight: 1.75, maxWidth: 420, marginBottom: '2.5rem' }}>
              TalentAI uses semantic AI to match resumes to jobs the way a senior recruiter would — understanding context, not just counting keywords.
            </p>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '3.5rem' }}>
              <Link href="/candidate/upload" style={{ background: 'linear-gradient(135deg, #7c6af7, #5e4fd8)', color: '#fff', padding: '14px 30px', borderRadius: 12, fontSize: '.95rem', fontWeight: 700, fontFamily: "'Poppins', sans-serif", display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 24px rgba(124,106,247,.4)', textDecoration: 'none', transition: 'all .2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 32px rgba(124,106,247,.5)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'none'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 24px rgba(124,106,247,.4)'; }}>
                Upload My Resume →
              </Link>
              <Link href="/recruiter/post-job" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', color: '#e8e8f0', padding: '14px 30px', borderRadius: 12, fontSize: '.95rem', fontWeight: 600, display: 'inline-block', textDecoration: 'none', transition: 'all .15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,.09)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,.05)'; }}>
                Recruiter Dashboard
              </Link>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: '2.5rem' }}>
              {[['3-Layer', 'AI Scoring Engine'], ['XAI', 'Full Explainability'], ['Fair', 'Bias-Aware Mode']].map(([val, sub]) => (
                <div key={val}>
                  <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: '1.4rem', background: 'linear-gradient(135deg,#7c6af7,#2dd4bf)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{val}</div>
                  <div style={{ fontSize: '.7rem', color: '#5a5a7a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 2 }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: visual mockup */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
            {/* Large circular bg */}
            <div style={{ width: 420, height: 420, borderRadius: '50%', background: 'rgba(20,20,50,.7)', border: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}>
              {/* Rotating dashes ring */}
              <div style={{ position: 'absolute', inset: -2, borderRadius: '50%', border: '1.5px dashed rgba(124,106,247,.3)', animation: 'slowSpin 40s linear infinite' }} />
              <style>{`@keyframes slowSpin{to{transform:rotate(360deg)}} @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}} @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} @keyframes pulseDot{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.2)}}`}</style>

              {/* Resume card */}
              <div style={{ width: 160, height: 200, background: 'linear-gradient(145deg, rgba(30,30,60,.9), rgba(20,20,45,.95))', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: '1.2rem', animation: 'floatY 4s ease-in-out infinite', boxShadow: '0 20px 60px rgba(0,0,0,.5)' }}>
                <div style={{ height: 10, background: 'rgba(255,255,255,.15)', borderRadius: 99, marginBottom: 8 }} />
                <div style={{ height: 7, background: 'rgba(255,255,255,.08)', borderRadius: 99, marginBottom: 6, width: '70%' }} />
                <div style={{ height: 7, background: 'rgba(255,255,255,.08)', borderRadius: 99, marginBottom: 16, width: '55%' }} />
                <div style={{ height: 6, background: 'rgba(124,106,247,.3)', borderRadius: 99, marginBottom: 5 }} />
                <div style={{ height: 6, background: 'rgba(124,106,247,.2)', borderRadius: 99, marginBottom: 5, width: '80%' }} />
                <div style={{ height: 6, background: 'rgba(124,106,247,.15)', borderRadius: 99, marginBottom: 14, width: '65%' }} />
                <div style={{ display: 'flex', gap: 5 }}>
                  {['Python', 'SQL', 'Flask'].map(s => (
                    <span key={s} style={{ fontSize: '.55rem', background: 'rgba(45,212,191,.15)', border: '1px solid rgba(45,212,191,.25)', color: '#5eead4', padding: '2px 7px', borderRadius: 99, fontWeight: 700 }}>{s}</span>
                  ))}
                </div>
              </div>

              {/* 94% Match bubble */}
              <div style={{ position: 'absolute', top: 60, right: -10, background: 'linear-gradient(135deg,rgba(45,212,191,.15),rgba(45,212,191,.08))', border: '1px solid rgba(45,212,191,.35)', borderRadius: 12, padding: '8px 16px', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2dd4bf', boxShadow: '0 0 10px #2dd4bf', animation: 'pulseDot 2s ease-in-out infinite' }} />
                <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: '.9rem', color: '#2dd4bf' }}>94% Match</span>
              </div>

              {/* Skill Missing tag */}
              <div style={{ position: 'absolute', bottom: 80, left: -20, background: 'rgba(244,63,94,.12)', border: '1px solid rgba(244,63,94,.3)', borderRadius: 10, padding: '7px 14px', backdropFilter: 'blur(12px)', fontSize: '.78rem', fontWeight: 700, color: '#fb7185' }}>
                ✗ Redis Missing
              </div>

              {/* Rank badge */}
              <div style={{ position: 'absolute', top: 30, left: 20, background: 'rgba(124,106,247,.15)', border: '1px solid rgba(124,106,247,.3)', borderRadius: 10, padding: '7px 14px', backdropFilter: 'blur(12px)', fontSize: '.78rem', fontWeight: 700, color: '#a08fff' }}>
                🏅 Rank #1
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section style={{ padding: '6rem 7vw', background: '#070712' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', fontWeight: 800, letterSpacing: '-.04em', marginBottom: 12 }}>
            Everything You Need
          </h2>
          <p style={{ color: '#5a5a7a', fontSize: '.95rem' }}>From resume upload to final hire decision — covered end-to-end.</p>
        </div>

        {/* Feature cards — 2-col bento layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto auto', gap: '1.25rem' }}>
          {/* Large cards */}
          {FEATURES.slice(0, 2).map((f, i) => (
            <div key={f.title}
              style={{ background: 'rgba(14,14,28,.8)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 18, padding: '2rem', transition: 'all .25s', cursor: 'default' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.border = '1px solid rgba(124,106,247,.25)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(124,106,247,.05)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.border = '1px solid rgba(255,255,255,.07)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(14,14,28,.8)'; }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', display: 'grid', placeItems: 'center', fontSize: '1.1rem', marginBottom: '1.2rem' }}>{f.icon}</div>
              <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: '1.05rem', fontWeight: 700, marginBottom: 10 }}>{f.title}</h3>
              <p style={{ fontSize: '.83rem', color: '#6666888', lineHeight: 1.7, marginBottom: '1.2rem' }}>{f.desc}</p>
              <p style={{ fontSize: '.83rem', color: '#707090', lineHeight: 1.7, marginBottom: '1.2rem' }}>{f.desc}</p>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {f.tags.map(t => (
                  <span key={t} style={{ fontSize: '.7rem', fontWeight: 700, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#9090b0', padding: '4px 12px', borderRadius: 99, letterSpacing: '.04em' }}>{t}</span>
                ))}
              </div>
            </div>
          ))}

          {/* 3 smaller cards in one row */}
          {FEATURES.slice(2).map(f => (
            <div key={f.title}
              style={{ background: 'rgba(14,14,28,.8)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 18, padding: '1.6rem', gridColumn: FEATURES.indexOf(f) === 2 ? '1' : 'auto', transition: 'all .25s', cursor: 'default' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.border = '1px solid rgba(45,212,191,.22)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(45,212,191,.03)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.border = '1px solid rgba(255,255,255,.07)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(14,14,28,.8)'; }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', display: 'grid', placeItems: 'center', fontSize: '1rem', marginBottom: '1rem' }}>{f.icon}</div>
              <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: '.95rem', fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: '.8rem', color: '#707090', lineHeight: 1.65, marginBottom: '1rem' }}>{f.desc}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {f.tags.map(t => (
                  <span key={t} style={{ fontSize: '.68rem', fontWeight: 700, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)', color: '#8888aa', padding: '3px 10px', borderRadius: 99 }}>{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section style={{ padding: '6rem 7vw', background: '#05050f', borderTop: '1px solid rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', fontWeight: 800, letterSpacing: '-.04em', marginBottom: 12 }}>How It Works</h2>
          <p style={{ color: '#5a5a7a', fontSize: '.95rem' }}>Three steps from resume to ranked match.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 700, margin: '0 auto' }}>
          {STEPS.map((step, i) => (
            <div key={step.num} style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', background: 'rgba(14,14,28,.7)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, padding: '1.6rem 1.75rem', transition: 'all .2s', cursor: 'default' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(124,106,247,.25)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,.06)'; }}>
              {/* Step circle */}
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(124,106,247,.2), rgba(45,212,191,.1))', border: '1px solid rgba(124,106,247,.25)', display: 'grid', placeItems: 'center', fontSize: '1.2rem', flexShrink: 0, boxShadow: '0 0 20px rgba(124,106,247,.15)' }}>{step.icon}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: '1rem' }}>{step.title}</span>
                  <span style={{ fontSize: '.65rem', fontWeight: 800, color: '#4a4a7a', fontFamily: "'Poppins', sans-serif", letterSpacing: '.08em' }}>{step.num}</span>
                </div>
                <p style={{ fontSize: '.85rem', color: '#6a6a8a', lineHeight: 1.7 }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────── */}
      <section style={{ padding: '6rem 7vw', background: '#07071a' }}>
        <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', fontWeight: 800, letterSpacing: '-.04em', marginBottom: 12 }}>
            Real Results. <span style={{ background: 'linear-gradient(135deg,#7c6af7,#2dd4bf)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Real Jobs.</span>
          </h2>
          <p style={{ color: '#5a5a7a', fontSize: '.95rem', maxWidth: 500, margin: '0 auto' }}>
            From students landing first roles to engineers getting promoted — here's what people say.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
          {TESTIMONIALS.map(t => (
            <div key={t.name} style={{ background: 'rgba(12,12,24,.9)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 18, padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', transition: 'all .2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,.12)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,.07)'; (e.currentTarget as HTMLDivElement).style.transform = 'none'; }}>
              <p style={{ fontSize: '.875rem', color: '#9090b0', lineHeight: 1.75, flex: 1 }}>"{t.text}"</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.05)' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.color + '22', border: `1px solid ${t.color}44`, display: 'grid', placeItems: 'center', fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: '.75rem', color: t.color, flexShrink: 0 }}>{t.initials}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.85rem', fontFamily: "'Poppins', sans-serif" }}>{t.name}</div>
                  <div style={{ fontSize: '.72rem', color: '#5a5a7a' }}>{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <Link href="/candidate/upload" style={{ display: 'inline-block', background: '#fff', color: '#05050f', padding: '14px 36px', borderRadius: 99, fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: '.95rem', textDecoration: 'none', transition: 'all .2s', boxShadow: '0 4px 20px rgba(255,255,255,.1)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 28px rgba(255,255,255,.15)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'none'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 20px rgba(255,255,255,.1)'; }}>
            Start Your Free Analysis →
          </Link>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section style={{ padding: '6rem 7vw', background: '#05050f', borderTop: '1px solid rgba(255,255,255,.04)' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', fontWeight: 800, letterSpacing: '-.04em', marginBottom: 12 }}>Common Questions</h2>
          <p style={{ color: '#5a5a7a', fontSize: '.95rem' }}>Everything you need to know before uploading.</p>
        </div>

        <div style={{ maxWidth: 700, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {FAQS.map((faq, i) => (
            <div key={faq.q}
              style={{ background: 'rgba(12,12,24,.8)', border: `1px solid ${openFaq === i ? 'rgba(124,106,247,.25)' : 'rgba(255,255,255,.07)'}`, borderRadius: 14, overflow: 'hidden', transition: 'border-color .2s', cursor: 'pointer' }}
              onClick={() => setOpenFaq(openFaq === i ? null : i)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.2rem 1.5rem' }}>
                <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '.925rem' }}>{faq.q}</span>
                <span style={{ color: '#5a5a7a', fontSize: '1.1rem', transition: 'transform .25s', display: 'inline-block', transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0)' }}>↓</span>
              </div>
              {openFaq === i && (
                <div style={{ padding: '0 1.5rem 1.2rem', fontSize: '.875rem', color: '#7070900', lineHeight: 1.75, borderTop: '1px solid rgba(255,255,255,.05)', paddingTop: '1rem' }}>
                  <p style={{ fontSize: '.875rem', color: '#707090', lineHeight: 1.75 }}>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── BOTTOM CTA ────────────────────────────────────────────────────── */}
      <section style={{ padding: '7rem 7vw', background: 'linear-gradient(135deg, #0a0820 0%, #060616 50%, #050510 100%)', borderTop: '1px solid rgba(124,106,247,.12)', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
        <div style={{ position: 'absolute', top: '-40%', left: '50%', transform: 'translateX(-50%)', width: 700, height: 500, background: 'radial-gradient(circle, rgba(124,106,247,.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 'clamp(2rem,4vw,3.2rem)', fontWeight: 800, letterSpacing: '-.04em', marginBottom: '1rem' }}>
            Ready to hire{' '}
            <span style={{ background: 'linear-gradient(135deg,#7c6af7,#2dd4bf)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>intelligently?</span>
          </h2>
          <p style={{ color: '#6060808', fontSize: '1rem', maxWidth: 480, margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
            <span style={{ color: '#606080' }}>Start screening resumes with semantic AI or upload your resume to find perfectly matched jobs — no setup required.</span>
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/candidate/upload" style={{ background: 'linear-gradient(135deg,#7c6af7,#5e4fd8)', color: '#fff', padding: '13px 28px', borderRadius: 12, fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: '.9rem', textDecoration: 'none', boxShadow: '0 4px 20px rgba(124,106,247,.35)', display: 'inline-block', transition: 'all .2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'none'; }}>
              Try as Candidate
            </Link>
            <Link href="/recruiter/post-job" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', color: '#e8e8f0', padding: '13px 28px', borderRadius: 12, fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '.9rem', textDecoration: 'none', display: 'inline-block', transition: 'all .15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,.06)'; }}>
              Try as Recruiter
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}