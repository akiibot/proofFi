'use client';
import Link from 'next/link';
import { useId, useState, type CSSProperties, type ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';
import styles from './kit.module.css';

/* ---------- Brand ---------- */

/** Figma "Logo": yellow tile + wordmark. The tile tilts on hover. */
export function Logo({ href = '/' }: { href?: string }) {
  return <Link href={href} className={styles.logo} aria-label="Vallet home">
    <span className={styles.logoMark} aria-hidden>V</span>
    <span className={styles.logoWord}>Vallet</span>
  </Link>;
}

export function Avatar({ initials }: { initials: string }) {
  return <span className={styles.avatar} aria-hidden>{initials}</span>;
}

/** Figma "Live dot": the ring breathes every 1.4s while the connection is ready. */
export function LiveDot({ tone = 'ready' }: { tone?: 'ready' | 'warn' | 'off' }) {
  return <span className={cx(styles.liveDot, styles[`live_${tone}`])} aria-hidden><span className={styles.liveRing} /><span className={styles.liveCore} /></span>;
}

/* ---------- Feedback ---------- */

export type StatusState = 'pass' | 'attention' | 'fail' | 'pending';

/** Figma "Status": quiet on purpose. Pass is neutral; only Attention is yellow, only Fail is red. */
export function Status({ state = 'pass', children, className }: { state?: StatusState; children: ReactNode; className?: string }) {
  return <span className={cx(styles.status, className)}>
    <span className={cx(styles.statusDot, styles[`status_${state}`])} aria-hidden>
      {state === 'pass' && <Icon name="check" size={12} />}
      {state === 'attention' && <Icon name="info" size={12} />}
      {state === 'fail' && <Icon name="cross" size={12} />}
    </span>
    <span>{children}</span>
  </span>;
}

export type TagTone = 'neutral' | 'brand' | 'success' | 'danger' | 'outline';
export function Tag({ tone = 'neutral', size = 'sm', children }: { tone?: TagTone; size?: 'sm' | 'md'; children: ReactNode }) {
  return <span className={cx(styles.tag, styles[`tag_${tone}`], styles[`tag_${size}`])}>{children}</span>;
}

type AlertProps = {
  tone?: 'needs-you' | 'info' | 'danger';
  title: ReactNode;
  description?: ReactNode;
  action?: { label: string; href?: string; onClick?: () => void; busy?: boolean };
  role?: 'alert' | 'status';
  className?: string;
  /** Marks the element for the first-run tour. */
  tour?: string;
};

/** Figma "Alert": only when something needs you or is wrong. Normal status never gets a banner. */
export function Alert({ tone = 'needs-you', title, description, action, role, className, tour }: AlertProps) {
  const kind = tone === 'needs-you' ? 'primary' : 'secondary';
  return <div className={cx(styles.alert, styles[`alert_${tone}`], className)} role={role} data-tour={tour}>
    <span className={styles.alertDot} aria-hidden />
    <div className={styles.alertText}>
      <p className={styles.alertTitle}>{title}</p>
      {description && <div className={styles.alertDescription}>{description}</div>}
    </div>
    {action && (action.href
      ? <Button kind={kind} href={action.href}>{action.label}</Button>
      : <Button kind={kind} onClick={action.onClick} busy={action.busy}>{action.label}</Button>)}
  </div>;
}

export function Skeleton({ width = '100%', height = 16, radius = 8, className }: { width?: number | string; height?: number | string; radius?: number; className?: string }) {
  return <span className={cx(styles.skeleton, className)} style={{ width, height, borderRadius: radius }} aria-hidden />;
}

/* ---------- Layout ---------- */

type PageHeaderProps = { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; size?: 'lg' | 'md'; titleId?: string; titleRef?: React.Ref<HTMLHeadingElement>; tour?: string };

/** Figma "Page header": every page leads with its answer as the headline. */
export function PageHeader({ eyebrow, title, subtitle, size = 'lg', titleId, titleRef, tour }: PageHeaderProps) {
  return <header className={styles.pageHeader} data-tour={tour}>
    {eyebrow && <p className={styles.pageEyebrow}>{eyebrow}</p>}
    <h1 id={titleId} ref={titleRef} tabIndex={-1} className={size === 'lg' ? 't-h5' : 't-h3'}>{title}</h1>
    {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
  </header>;
}

/** Figma "Stat": one labelled number. Never boxed. */
export function Stat({ icon, label, value, description, size = 'lg', testId }: { icon?: IconName; label: string; value: ReactNode; description?: ReactNode; size?: 'lg' | 'md'; testId?: string }) {
  return <div className={styles.stat}>
    <p className={styles.statLabel}>{icon && <Icon name={icon} size={16} />}{label}</p>
    <p className={cx(size === 'lg' ? 't-h5' : 't-h4', 'tabular', styles.statValue)} data-testid={testId}>{value}</p>
    {description && <p className={styles.statDescription}>{description}</p>}
  </div>;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cx(styles.divider, className)} />;
}

export type Segment = { label: string; amountMinor: number; tone: 'protected' | 'living' | 'free'; caption: string };

/** Figma "Allocation bar": where the money is. Protected is the yellow segment. Widths come from the data. */
export function AllocationBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.amountMinor), 0) || 1;
  return <figure className={styles.allocation} aria-label={segments.map((s) => s.caption).join(', ')}>
    <div className={styles.allocationBar}>
      {segments.map((s, i) => <span key={s.label} className={cx(styles.segment, styles[`seg_${s.tone}`])}
        style={{ '--w': `${(Math.max(0, s.amountMinor) / total) * 100}%`, '--i': i } as CSSProperties} />)}
    </div>
    <figcaption className={styles.legend}>
      {segments.map((s) => <span key={s.label}><i className={styles[`seg_${s.tone}`]} aria-hidden />{s.caption}</span>)}
    </figcaption>
  </figure>;
}

type ActivityRowProps = { icon: IconName; title: ReactNode; description?: ReactNode; href?: string; onClick?: () => void; kind?: 'default' | 'needs-you'; meta?: ReactNode; trailing?: ReactNode; index?: number; testId?: string; at?: string };

/** Figma "Activity item": one thing that happened, in plain words. "Needs you" carries the only yellow on a list. */
export function ActivityRow({ icon, title, description, href, onClick, kind = 'default', meta, trailing, index = 0, testId, at }: ActivityRowProps) {
  const body = <>
    <span className={cx(styles.rowIcon, kind === 'needs-you' && styles.rowIconNeedsYou)} aria-hidden><Icon name={icon} size={20} /></span>
    <span className={styles.rowText}>
      <span className={styles.rowTitle}>{title}</span>
      {description && <span className={styles.rowDescription}>{description}</span>}
    </span>
    {meta && <span className={styles.rowMeta}>{meta}</span>}
    {trailing}
    {(href || onClick) && !trailing && <Icon name="chevron-right" size={16} className={styles.rowChevron} />}
  </>;
  const style = { '--i': index } as CSSProperties;
  const data = { 'data-testid': testId, 'data-at': at };
  if (href) return <Link href={href} className={cx(styles.row, styles.rowInteractive, 'rise')} style={style} {...data}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cx(styles.row, styles.rowInteractive, 'rise')} style={style} {...data}>{body}</button>;
  return <div className={cx(styles.row, 'rise')} style={style} {...data}>{body}</div>;
}

/** Figma "Key value row". */
export function KeyValue({ label, value, mono, testId }: { label: ReactNode; value: ReactNode; mono?: boolean; testId?: string }) {
  return <div className={styles.kv}>
    <dt>{label}</dt>
    <dd className={mono ? styles.kvMono : undefined} data-testid={testId}>{value}</dd>
  </div>;
}

export function KeyValueList({ children, label, className }: { children: ReactNode; label?: string; className?: string }) {
  return <dl className={cx(styles.kvList, className)} aria-label={label}>{children}</dl>;
}

/** Figma "Disclosure row": proof stays one click away. Height animates open and closed. */
export function Disclosure({ title, meta = 'Show', openMeta = 'Hide', children, defaultOpen = false, className }: { title: ReactNode; meta?: string; openMeta?: string; children: ReactNode; defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return <div className={cx(styles.disclosure, open && styles.disclosureOpen, className)}>
    <button type="button" className={styles.disclosureHeader} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
      <span className={styles.disclosureTitle}>{title}</span>
      <span className={styles.disclosureMeta}>{open ? openMeta : meta}</span>
      <Icon name="chevron-down" size={16} className={styles.disclosureChevron} />
    </button>
    <div id={id} className={styles.disclosureBody} role="region" aria-hidden={!open} inert={!open}>
      <div className={styles.disclosureInner}>{children}</div>
    </div>
  </div>;
}

/* ---------- Steps ---------- */

export type StepState = 'done' | 'active' | 'todo';

/** Figma "Run step": what Vallet is doing right now. Only steps the backend has really finished are shown as done. */
export function RunStep({ state, title, description }: { state: StepState; title: ReactNode; description?: ReactNode }) {
  return <li className={cx(styles.runStep, styles[`run_${state}`])} aria-current={state === 'active' ? 'step' : undefined}>
    <span className={styles.runIndicator} aria-hidden>{state === 'done' ? <Icon name="check" size={16} /> : state === 'active' ? <span className={styles.runPulse} /> : null}</span>
    <span className={styles.runText}>
      <span className={styles.runTitle}>{title}<span className="sr-only">{state === 'done' ? ' (done)' : state === 'active' ? ' (in progress)' : ' (not started)'}</span></span>
      {description && <span className={styles.runDescription}>{description}</span>}
    </span>
  </li>;
}

/** Figma "Progress step": the compact stepper above the approval screen. */
export function ProgressSteps({ steps }: { steps: { label: string; state: 'done' | 'current' | 'todo' }[] }) {
  return <ol className={styles.progress} aria-label="Progress">
    {steps.map((s) => <li key={s.label} className={styles[`prog_${s.state}`]} aria-current={s.state === 'current' ? 'step' : undefined}>
      <span className={styles.progIndicator} aria-hidden>{s.state === 'done' && <Icon name="check" size={12} />}</span>{s.label}
    </li>)}
  </ol>;
}

/** Figma "Timeline step": one linked step of a payment's story. */
export function TimelineStep({ icon, title, description, time, last, action, index = 0 }: { icon: IconName; title: ReactNode; description?: ReactNode; time?: ReactNode; last?: boolean; action?: ReactNode; index?: number }) {
  return <li className={cx(styles.timeline, last && styles.timelineLast, 'rise')} style={{ '--i': index } as CSSProperties}>
    <span className={styles.timelineRail} aria-hidden><span className={styles.timelineDot}><Icon name={icon} size={16} /></span>{!last && <span className={styles.timelineLine} />}</span>
    <span className={styles.timelineText}>
      <span className={styles.timelineTitle}>{title}</span>
      {description && <span className={styles.timelineDescription}>{description}</span>}
    </span>
    <span className={styles.timelineMeta}>{time && <span className={styles.timelineTime}>{time}</span>}{action}</span>
  </li>;
}

/** Figma "Edge state card": what happened, what it means for your money, one next step. */
export function EdgeCard({ where, title, description, action, tone = 'neutral', role = 'alert' }: { where?: string; title: ReactNode; description: ReactNode; action?: ReactNode; tone?: 'neutral' | 'danger' | 'attention'; role?: 'alert' | 'status' }) {
  return <div className={cx(styles.edge, styles[`edge_${tone}`])} role={role}>
    {where && <p className="t-overline c-low">{where}</p>}
    <p className={styles.edgeTitle}>{title}</p>
    <div className={styles.edgeDescription}>{description}</div>
    {action && <div className={styles.edgeAction}>{action}</div>}
  </div>;
}
