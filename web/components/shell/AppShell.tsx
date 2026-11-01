'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ICONS } from '../../lib/icons';
import type { NavGroup, NavItem } from '../../lib/nav';
import { ShellFooter } from './ShellFooter';
import { ThemeToggle } from './ThemeToggle';

const isCurrent = (item: NavItem, pathname: string) =>
  item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`);

/**
 * The original dashboard's frame: a 252px sidebar (a drawer with a scrim under 860px), a sticky top bar
 * and the content column. Pages render inside; nothing here fetches data.
 */
export function AppShell({
  groups,
  userName,
  banner,
  children,
}: {
  groups: NavGroup[];
  userName?: string;
  /** A persistent notice above the page (for example: the subscription has lapsed and the account is read-only). */
  banner?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const all = groups.flatMap((g) => g.items);
  const title = all.find((n) => isCurrent(n, pathname))?.label ?? '';

  useEffect(() => setOpen(false), [pathname]); // a navigation closes the drawer
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="shell">
      <aside className={`sidebar${open ? ' open' : ''}`} id="sidebar">
        <div className="brand">
          <div className="mark" aria-hidden="true">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" />
            </svg>
          </div>
          <div>
            <div className="name">Lead to Doctor</div>
            <div className="who" id="welcome-text">{userName}</div>
          </div>
        </div>

        <nav className="nav" id="nav" aria-label="القائمة الرئيسية">
          {groups.map((g, i) => (
            <div key={g.title ?? `g${i}`} style={{ display: 'contents' }}>
              {g.title && <div className="nav-group">{g.title}</div>}
              {g.items.map((n) => (
                <Link key={n.id} href={n.href} className="nav-item" aria-current={isCurrent(n, pathname) ? 'page' : undefined}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[n.id] ?? '' }} />
                  <span>{n.label}</span>
                  {n.badge && <span className="count hidden" id={`nav-badge-${n.badge}`} />}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <ShellFooter />
      </aside>

      <div className="main">
        <div className="topbar">
          <button type="button" className="menu-btn icon-only" id="menu-btn" aria-label="القائمة" aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen((v) => !v)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h2 id="page-title">{title}</h2>
          <div className="spacer" />
          <ThemeToggle />
        </div>

        {banner && (
          <div className="bulk-bar" role="status" style={{ margin: '14px 28px 0' }}>
            {banner}
          </div>
        )}

        <div className="content page-enter" id="content" key={pathname}>
          {children}
        </div>
      </div>

      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
    </div>
  );
}
