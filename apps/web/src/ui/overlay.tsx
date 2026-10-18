'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';
import { IconButton } from './Button';
import styles from './overlay.module.css';

const EXIT_MS = 220;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** True only in the browser: portals need `document`, so nothing renders during server rendering. */
function useBrowser(): boolean {
  const [browser, setBrowser] = useState(false);
  useEffect(() => setBrowser(true), []);
  return browser;
}

/** Keeps the element mounted for its exit animation after `open` turns false. */
function usePresence(open: boolean) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) { setMounted(true); setClosing(false); return; }
    if (!mounted) return;
    setClosing(true);
    const timer = window.setTimeout(() => { setMounted(false); setClosing(false); }, EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);
  return { mounted, closing };
}

/** Focus moves into the panel, Tab stays inside, Escape closes, and focus returns to what opened it. */
function useModal(open: boolean, panel: React.RefObject<HTMLDivElement | null>, onClose: () => void, dismissible: boolean) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus({ preventScroll: true });
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && dismissible) { event.stopPropagation(); close.current(); return; }
      if (event.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const [head, tail] = [items[0], items[items.length - 1]];
      if (event.shiftKey && document.activeElement === head) { event.preventDefault(); tail.focus(); }
      else if (!event.shiftKey && document.activeElement === tail) { event.preventDefault(); head.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [open, panel, dismissible]);
}

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** A busy mutation must finish before the panel can be dismissed. */
  dismissible?: boolean;
  description?: ReactNode;
  footer?: ReactNode;
  label?: string;
};

/** Figma "Drawer" (38:132): proof and detail slide in from the right, 600px wide. */
export function Drawer({ open, onClose, title, children, dismissible = true, label }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { mounted, closing } = usePresence(open);
  const browser = useBrowser();
  useModal(open && browser && mounted, panel, onClose, dismissible);
  if (!mounted || !browser) return null;
  return createPortal(<div className={cx(styles.layer, closing && styles.closing)}>
    <div className={styles.scrim} onClick={() => dismissible && onClose()} aria-hidden />
    <div ref={panel} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby={label ? undefined : titleId} aria-label={label} tabIndex={-1}>
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>{title}</h2>
        <IconButton icon="cross" label="Close" size="md" onClick={onClose} disabled={!dismissible} />
      </div>
      <div className={styles.drawerBody}>{children}</div>
    </div>
  </div>, document.body);
}

/** Figma "Dialog" (38:103): one state-changing acknowledgement, centered. */
export function Dialog({ open, onClose, title, description, children, footer, dismissible = true, label }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const { mounted, closing } = usePresence(open);
  const browser = useBrowser();
  useModal(open && browser && mounted, panel, onClose, dismissible);
  if (!mounted || !browser) return null;
  return createPortal(<div className={cx(styles.layer, styles.center, closing && styles.closing)}>
    <div className={styles.scrim} onClick={() => dismissible && onClose()} aria-hidden />
    <div ref={panel} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={label ? undefined : titleId} aria-label={label} aria-describedby={description ? descriptionId : undefined} tabIndex={-1}>
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>{title}</h2>
        <IconButton icon="cross" label="Close" size="sm" onClick={onClose} disabled={!dismissible} />
      </div>
      {description && <div id={descriptionId} className={styles.description}>{description}</div>}
      {children}
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  </div>, document.body);
}
