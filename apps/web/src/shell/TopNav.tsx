'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/Icon';
import { Avatar, LiveDot, Logo } from '@/ui/kit';
import { useApp } from './AppContext';
import styles from './shell.module.css';

export const TABS = [
  { label: 'Home', href: '/', match: (p: string) => p === '/' },
  { label: 'Ask', href: '/ask', match: (p: string) => p.startsWith('/ask') || p.startsWith('/approve') },
  { label: 'Rules', href: '/rules', match: (p: string) => p.startsWith('/rules') },
  { label: 'Activity', href: '/activity', match: (p: string) => p.startsWith('/activity') || p.startsWith('/security') },
];

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Figma "Top nav" (36:122): brand, navigation and account capsules. The yellow-marked active pill is one element that
 * slides between tabs, because this nav lives in the shared layout and survives page changes.
 */
export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { chain, chainProblem, needsYou, setChainOpen, signOut, signOutError } = useApp();
  const tabs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pill, setPill] = useState<{ left: number; width: number; ready: boolean } | null>(null);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const active = TABS.findIndex((t) => t.match(pathname));

  useIsoLayoutEffect(() => {
    const measure = () => {
      const el = tabs.current[active];
      if (!el) { setPill(null); return; }
      setPill((prev) => ({ left: el.offsetLeft, width: el.offsetWidth, ready: prev !== null }));
    };
    measure();
    window.addEventListener('resize', measure);
    void document.fonts?.ready.then(measure);
    return () => window.removeEventListener('resize', measure);
  }, [active]);

  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !menuRef.current?.contains(event.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [menu]);

  const tone = chainProblem ? 'warn' : chain?.status === 'READY' ? 'ready' : chain ? 'warn' : 'off';
  const chainLabel = chainProblem ? 'Testnet unavailable' : chain?.status === 'READY' ? 'Base Sepolia · testnet' : chain?.status === 'CHAIN_NOT_CONFIGURED' ? 'Testnet not configured' : chain ? 'Testnet unavailable' : 'Base Sepolia · testnet';
  const count = needsYou.length;
  const first = needsYou[0];

  return <header className={styles.topNav}>
    <div className={styles.capsule}><Logo /></div>

    <nav className={cx(styles.capsule, styles.tabs)} aria-label="Main">
      {pill && <span className={cx(styles.activePill, pill.ready && styles.activePillMoving)} style={{ transform: `translateX(${pill.left - 4}px)`, width: pill.width }} aria-hidden><span className={styles.indicator} /></span>}
      {TABS.map((tab, i) => <Link key={tab.href} href={tab.href} ref={(el) => { tabs.current[i] = el; }} className={cx(styles.tab, i === active && styles.tabActive)} aria-current={i === active ? 'page' : undefined}>{tab.label}</Link>)}
    </nav>

    <div className={cx(styles.capsule, styles.account)}>
      <button type="button" className={styles.chainButton} onClick={() => setChainOpen(true)} aria-haspopup="dialog">
        <LiveDot tone={tone} /><span>{chainLabel}</span>
      </button>
      <span className={styles.separator} aria-hidden />
      <button type="button" className={styles.notify} aria-label={count ? (count === 1 ? '1 thing needs you' : `${count} things need you`) : 'Nothing needs you'}
        onClick={() => router.push(first ? `/approve?id=${encodeURIComponent(first.certificateId)}` : '/activity?filter=needs-you')}>
        <Icon name="bell" size={20} className={styles.bell} />
        {count > 0 && <span key={count} className={styles.badge} aria-hidden>{count > 9 ? '9+' : count}</span>}
      </button>
      <div className={styles.menuWrap} ref={menuRef}>
        <button type="button" className={styles.avatarButton} aria-label="Account" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}><Avatar initials="DU" /></button>
        {menu && <div className={styles.menu} role="menu">
          <Link role="menuitem" href="/settings" className={styles.menuItem} onClick={()=>setMenu(false)}>Settings</Link>
          <p className={styles.menuWho}>Demo user<span>Testnet demo · synthetic USD</span></p>
          <button type="button" role="menuitem" className={styles.menuItem} onClick={() => { setMenu(false); void signOut(); }}>Sign out</button>
        </div>}
      </div>
    </div>
    {signOutError && <p role="alert" className={styles.signOutError}>{signOutError}</p>}
  </header>;
}

