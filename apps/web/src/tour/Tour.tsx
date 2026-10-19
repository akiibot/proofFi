'use client';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, TextLink } from '@/ui/Button';
import { cx } from '@/ui/cx';
import { HOME_INTRO, markTourSeen, TOUR_KEY, tourTarget, type TourIntro, type TourStep } from './steps';
import styles from './tour.module.css';

type Box = { top: number; left: number; width: number; height: number };
const PAD = 8;    // space between the highlighted element and its ring
const GAP = 16;   // space between the ring and the card
const EDGE = 16;  // the card never touches the viewport edge
const FOCUSABLE = 'a[href], button:not([disabled])';

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Where the card sits: under the highlight when it fits, otherwise above, always inside the viewport. */
function place(box: Box | null, card: { w: number; h: number }, vw: number, vh: number) {
  if (!box) return { top: (vh - card.h) / 2, left: (vw - card.w) / 2, side: null as null | 'below' | 'above', caret: 0 };
  const below = box.top + box.height + GAP;
  const above = box.top - GAP - card.h;
  const side = below + card.h <= vh - EDGE || above < EDGE ? 'below' : 'above';
  const top = clamp(side === 'below' ? below : above, EDGE, vh - card.h - EDGE);
  const left = clamp(box.left + box.width / 2 - card.w / 2, EDGE, vw - card.w - EDGE);
  return { top, left, side: side as 'below' | 'above', caret: clamp(box.left + box.width / 2 - left, 28, card.w - 28) };
}

/**
 * First-run tour: a welcome card, then one step per highlighted part of Home. The page behind is dimmed and cannot be
 * clicked; the highlighted part stays visible through a ringed cut-out. Skip, Escape or Finish end it for good.
 */
export function Tour({ steps, onClose, storageKey = TOUR_KEY, intro = HOME_INTRO }: { steps: TourStep[]; onClose: () => void; storageKey?: string; intro?: TourIntro }) {
  const [index, setIndex] = useState(-1);
  const [box, setBox] = useState<Box | null>(null);
  const [card, setCard] = useState({ w: 380, h: 240 });
  const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight });
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const total = steps.length;
  const step = index >= 0 ? steps[index] : null;
  const last = index === total - 1;

  const end = useCallback((how: 'done' | 'skipped') => { markTourSeen(how, storageKey); onClose(); }, [onClose, storageKey]);
  const next = useCallback(() => (last ? end('done') : setIndex((i) => i + 1)), [last, end]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // The page stays still behind the tour; focus returns to where it was when the tour ends.
  useLayoutEffect(() => {
    // Capture before the later layout effect moves focus into the tour.
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const resize = () => setView({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      document.documentElement.style.overflow = overflow;
      const target = previous?.isConnected && previous !== document.body
        ? previous : document.querySelector<HTMLElement>('[data-tour="account"] button');
      target?.focus({ preventScroll: true });
    };
  }, []);

  // Bring the step's element into view, then follow its box every frame while it scrolls or the layout shifts.
  useEffect(() => {
    if (!step) { setBox(null); return; }
    const el = tourTarget(step.target);
    if (!el) { setBox(null); return; }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    let frame = 0;
    let seen = '';
    const follow = () => {
      const r = el.getBoundingClientRect();
      const key = `${Math.round(r.top)},${Math.round(r.left)},${Math.round(r.width)},${Math.round(r.height)}`;
      if (key !== seen) { seen = key; setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 }); }
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, [step]);

  // Measure the card so it can be placed without overflowing; focus the main action of each step.
  useLayoutEffect(() => {
    const node = panel.current;
    if (!node) return;
    const w = node.offsetWidth, h = node.offsetHeight;
    setCard((c) => (c.w === w && c.h === h ? c : { w, h }));
    node.querySelector<HTMLElement>('[data-primary]')?.focus({ preventScroll: true });
  }, [index, view.w]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); end('skipped'); return; }
      if (event.key === 'ArrowRight') { event.preventDefault(); if (index < 0) setIndex(0); else next(); return; }
      if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); back(); return; }
      if (event.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const [head, tail] = [items[0], items[items.length - 1]];
      if (event.shiftKey && document.activeElement === head) { event.preventDefault(); tail.focus(); }
      else if (!event.shiftKey && document.activeElement === tail) { event.preventDefault(); head.focus(); }
      else if (!panel.current.contains(document.activeElement)) { event.preventDefault(); head.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, next, back, end]);

  const spot = step ? box : null;
  const pos = place(spot, card, view.w, view.h);
  const done = index + 1;

  return createPortal(<div className={styles.layer} data-testid="tour">
    <div className={styles.blocker} aria-hidden />
    {spot
      ? <div className={styles.spot} style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }} aria-hidden />
      : <div className={styles.scrim} aria-hidden />}
    <div ref={panel} className={cx(styles.card, !spot && styles.centered)} style={{ top: pos.top, left: pos.left }}
      role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} tabIndex={-1}>
      {pos.side && <span className={cx(styles.caret, styles[pos.side])} style={{ left: pos.caret }} aria-hidden />}
      <div className={styles.progress}>
        <div className={styles.track} role="progressbar" aria-label="Tour progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.max(0, done)}>
          <span className={styles.fill} style={{ width: `${(Math.max(0, done) / total) * 100}%` }} />
        </div>
        <span className={styles.count} data-testid="tour-count">{Math.max(0, done)} / {total}</span>
      </div>
      <div key={index} className={styles.content}>
        <p className={styles.eyebrow}>{step ? step.eyebrow : intro.eyebrow}</p>
        <h2 id={titleId} className={styles.title}>{step ? step.title : intro.title}</h2>
        <p id={bodyId} className={styles.body}>{step ? step.body : intro.body.replace('{steps}', String(total))}</p>
      </div>
      <div className={styles.footer}>
        <TextLink className={styles.skip} onClick={() => end('skipped')}>{step ? 'Skip tour' : 'Skip'}</TextLink>
        {index > 0 && <Button kind="tertiary" size="md" onClick={back}>Back</Button>}
        {step
          ? <Button kind="primary" size="md" onClick={next} data-primary rightIcon={last ? undefined : 'arrow-right'}>{last ? 'Finish' : 'Next'}</Button>
          : <Button kind="primary" size="md" onClick={() => setIndex(0)} data-primary rightIcon="arrow-right">Start the tour</Button>}
      </div>
      <p className="sr-only" aria-live="polite">{step ? `Step ${done} of ${total}: ${step.title}` : ''}</p>
    </div>
  </div>, document.body);
}
