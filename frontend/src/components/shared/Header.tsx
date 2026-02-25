'use client';
// src/components/shared/Header.tsx
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Header() {
  const path = usePathname();
  const isCand = path.startsWith('/candidate');
  const isRec  = path.startsWith('/recruiter');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const navLinks = [
    { label: 'Home',      href: '/' },
    { label: 'Candidate', href: '/candidate/upload' },
    { label: 'Recruiter', href: '/recruiter/post-job' },
  ];

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, height: 64,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 1.75rem',
      background: scrolled ? 'rgba(6,6,12,.92)' : 'rgba(6,6,12,.75)',
      backdropFilter: 'blur(24px)',
      borderBottom: `1px solid ${scrolled ? 'var(--border-hi)' : 'var(--border)'}`,
      transition: 'all .3s',
    }}>
      {/* Logo */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,var(--violet),var(--teal))', display: 'grid', placeItems: 'center', fontSize: '1rem', boxShadow: '0 2px 12px rgba(124,106,247,.4)', flexShrink: 0 }}>🧠</div>
        <span style={{ fontFamily: 'var(--font-d)', fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-.03em' }}>
          Talent<span style={{ color: 'var(--vl)' }}>AI</span>
        </span>
      </Link>

      {/* Center nav */}
      <nav style={{ display: 'flex', gap: 2 }}>
        {navLinks.map(n => {
          const active = n.href === '/' ? path === '/' : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} style={{
              padding: '7px 16px', borderRadius: 8,
              fontSize: '.85rem', fontWeight: active ? 700 : 500,
              fontFamily: active ? 'var(--font-d)' : 'var(--font-b)',
              color: active ? 'var(--text)' : 'var(--text-m)',
              background: active ? 'var(--surface2)' : 'transparent',
              transition: 'all .15s',
            }}>{n.label}</Link>
          );
        })}
      </nav>

      {/* Role toggle */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 3 }}>
        {[
          { label: 'Candidate', href: '/candidate/upload', active: isCand },
          { label: 'Recruiter', href: '/recruiter/post-job', active: isRec },
        ].map(r => (
          <Link key={r.label} href={r.href} style={{
            padding: '6px 16px', borderRadius: 8,
            fontSize: '.78rem', fontWeight: 700, fontFamily: 'var(--font-d)',
            background: r.active ? 'linear-gradient(135deg,var(--violet),#5e4fd8)' : 'transparent',
            color: r.active ? '#fff' : 'var(--text-m)',
            boxShadow: r.active ? '0 2px 10px rgba(124,106,247,.35)' : 'none',
            transition: 'all .2s',
          }}>{r.label}</Link>
        ))}
      </div>
    </header>
  );
}
