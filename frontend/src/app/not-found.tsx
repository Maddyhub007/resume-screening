'use client';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'calc(100vh - 64px)', textAlign:'center', padding:'2rem', position:'relative' }}>
      <div className="bg-grid" style={{ position:'absolute', inset:0, opacity:.3 }} />
      <div style={{ position:'relative', zIndex:1 }}>
        <div style={{ fontFamily:'var(--font-d)', fontSize:'clamp(5rem,15vw,9rem)', fontWeight:800, letterSpacing:'-.05em', lineHeight:1 }} className="grad-text">404</div>
        <h2 style={{ fontFamily:'var(--font-d)', fontSize:'1.4rem', fontWeight:700, margin:'1rem 0 .75rem' }}>Page not found</h2>
        <p style={{ color:'var(--text-m)', marginBottom:'2rem', fontSize:'.9rem' }}>The page you're looking for doesn't exist.</p>
        <div style={{ display:'flex', gap:'1rem', justifyContent:'center' }}>
          <Link href="/" className="btn-primary" style={{ padding:'10px 24px', borderRadius:'10px', fontSize:'.9rem', display:'inline-block' }}>Go Home</Link>
          <Link href="/candidate/upload" className="btn-secondary" style={{ padding:'10px 24px', borderRadius:'10px', fontSize:'.9rem', display:'inline-block' }}>Upload Resume</Link>
        </div>
      </div>
    </div>
  );
}
