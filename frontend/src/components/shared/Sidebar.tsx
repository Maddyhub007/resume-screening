'use client';
// src/components/shared/Sidebar.tsx
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const CANDIDATE_NAV = [
  { label: 'Upload Resume',       href: '/candidate/upload',     icon: '📄', desc: 'Parse & extract data' },
  { label: 'Match Results',       href: '/candidate/results',    icon: '🎯', desc: '3-layer score breakdown' },
  { label: 'Job Recommendations', href: '/candidate/jobs',       icon: '💼', desc: 'AI-matched openings' },
  { label: 'Skill Gap Analysis',  href: '/candidate/skills-gap', icon: '📊', desc: 'Upskilling roadmap' },
];

const RECRUITER_NAV = [
  { label: 'Post a Job',          href: '/recruiter/post-job',   icon: '📋', desc: 'Add job description' },
  { label: 'Candidate Rankings',  href: '/recruiter/candidates', icon: '👥', desc: 'Ranked by AI score', badge: 'Live' },
  { label: 'Analysis Panel',      href: '/recruiter/analysis',   icon: '🔍', desc: 'XAI per candidate' },
  { label: 'Reports',             href: '/recruiter/reports',    icon: '📈', desc: 'Hiring analytics' },
];

export default function Sidebar({ role }: { role: 'candidate' | 'recruiter' }) {
  const path = usePathname();
  const nav  = role === 'candidate' ? CANDIDATE_NAV : RECRUITER_NAV;
  const badgeColor = role === 'candidate'
    ? { bg: 'var(--vd)', border: 'rgba(124,106,247,.2)', text: 'var(--vl)' }
    : { bg: 'var(--td)', border: 'rgba(45,212,191,.2)',  text: 'var(--tl)' };

  return (
    <aside style={{ width: 252, flexShrink: 0, position: 'sticky', top: 64, height: 'calc(100vh - 64px)', overflowY: 'auto', background: 'var(--surface)', borderRight: '1px solid var(--border)', padding: '1.5rem 0', display: 'flex', flexDirection: 'column' }}>
      {/* Role header */}
      <div style={{ padding: '0 16px 14px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: badgeColor.bg, border: `1px solid ${badgeColor.border}`, color: badgeColor.text, padding: '4px 12px', borderRadius: 99, fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em' }}>
          {role === 'candidate' ? '👤' : '🏢'} {role}
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: '0 10px', flex: 1 }}>
        {nav.map(item => {
          const active = path === item.href;
          return (
            <Link key={item.href} href={item.href}
              className={`sb-link${active ? ' active' : ''}`}
              style={{ marginBottom: 2 }}
            >
              <span style={{ fontSize: '1rem', width: 22, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: active ? 700 : 500, fontSize: '.86rem', lineHeight: 1.2 }}>{item.label}</div>
                <div style={{ fontSize: '.7rem', color: 'var(--text-d)', marginTop: 1 }}>{item.desc}</div>
              </div>
              {item.badge && (
                <span style={{ background: 'var(--td)', color: 'var(--teal)', border: '1px solid rgba(45,212,191,.25)', fontSize: '.58rem', fontWeight: 800, padding: '2px 6px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '.06em', alignSelf: 'flex-start', marginTop: 2 }}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* AI status */}
      <div style={{ padding: '1rem 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 8, padding: '8px 12px' }}>
          <div className="ai-status-dot" />
          <span style={{ fontSize: '.72rem', color: 'var(--emerald)', fontWeight: 700 }}>AI Model Active</span>
        </div>
      </div>
    </aside>
  );
}
