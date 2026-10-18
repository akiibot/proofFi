'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { canonicalDigest } from '@/lib/canonical';
import { formatUtc } from '@/lib/format';
import { CONTRACT_DEFAULTS, FIXED, toForm, type Draft, type FormValues } from '@/components/constitution/rules';
import { Page } from '@/shell/AppFrame';
import { useApp } from '@/shell/AppContext';
import { cx } from '@/ui/cx';
import { Button, TextLink } from '@/ui/Button';
import { Checkbox } from '@/ui/form';
import { Icon } from '@/ui/Icon';
import { Alert, EdgeCard, PageHeader, Skeleton, Status, Tag } from '@/ui/kit';
import { Dialog } from '@/ui/overlay';
import { addressList, changeValue, display, GROUPS, LINES, sameValue, type Line } from './lines';
import { useConstitution } from './useConstitution';
import styles from './rules.module.css';

const TAG_TONE = { Always: 'neutral', 'Your OK': 'neutral', Simulated: 'neutral' } as const;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function RuleLine({ line, value, base, editing, error, onChange }: { line: Line; value: string; base: string | null; editing: boolean; error?: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const changed = editing && base !== null && !sameValue(line, value, base);
  const id = `rule-${line.key}`;
  const field = line.kind === 'addresses'
    ? <button type="button" className={cx(styles.valueField, styles.valueButton, changed && styles.valueChanged, error && styles.valueError)} aria-expanded={open} aria-controls={`${id}-list`} onClick={() => setOpen((o) => !o)}>
      {display(line, value)}<Icon name="chevron-down" size={16} className={open ? styles.flip : undefined} />
    </button>
    : <span className={cx(styles.valueField, changed && styles.valueChanged, error && styles.valueError)}>
      {line.kind === 'usd' && <span aria-hidden>$</span>}
      <input id={id} name={line.key} aria-label={line.label} value={value} inputMode="decimal" autoComplete="off" onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} />
      {line.kind === 'bps' && <span aria-hidden>%</span>}
    </span>;
  return <li className={cx(styles.line, editing && styles.lineEditing)}>
    <span className={styles.number}>{line.number}</span>
    <span className={styles.sentence}>
      {line.before}{' '}{editing ? field : <strong>{display(line, value)}</strong>}{line.after.startsWith('.') ? '' : ' '}{line.after}
    </span>
    {changed && base !== null ? <span className={styles.was}>was {display(line, base)}</span> : <Tag tone={TAG_TONE[line.tag]}>{line.tag}</Tag>}
    {editing && line.kind === 'addresses' && open && <div className={styles.addresses} id={`${id}-list`}>
      <label htmlFor={id} className="sr-only">{line.label}</label>
      <textarea id={id} name={line.key} rows={3} spellCheck={false} placeholder="0x…" value={value} onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} />
      <small id={`${id}-help`}>One 0x address per line.</small>
    </div>}
    {error && <small id={`${id}-error`} className={styles.lineError} role="alert">{error}</small>}
  </li>;
}

/** Figma "12 Rules", "13 Rules edit" and "14 Rules review": the rules as sentences, edited in place, confirmed once. */
export function RulesScreen() {
  const { loaded, loadError, load, saveDraft, confirm, base } = useConstitution();
  const { refreshNeedsYou } = useApp();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormValues | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [review, setReview] = useState<Draft | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [digestError, setDigestError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState<'save' | 'confirm' | null>(null);
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);

  const baseForm = useMemo(() => toForm(base), [base]);
  useEffect(() => { if (loaded && !form) setForm(toForm(loaded.active?.rules ?? loaded.pending?.rules ?? CONTRACT_DEFAULTS)); }, [loaded, form]);
  useEffect(() => {
    if (!review) { setDigest(null); return; }
    let live = true;
    setDigest(null); setDigestError('');
    canonicalDigest(review.rules).then((d) => { if (live) setDigest(d); }).catch(() => { if (live) setDigestError('This browser could not compute the policy fingerprint, so the draft cannot be confirmed here.'); });
    return () => { live = false; };
  }, [review]);

  if (loadError) return <Page width={760}><EdgeCard where="Rules" title="Your rules could not be loaded" description={loadError} action={<Button kind="secondary" onClick={() => void load()}>Try again</Button>} /></Page>;
  if (!loaded || !form) return <Page width={760}><div className={styles.loading} role="status" aria-label="Loading your rules"><Skeleton width={140} height={20} /><Skeleton width="40%" height={52} radius={12} />{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={40} />)}</div></Page>;

  const active = loaded.active;
  const changes = active ? LINES.filter((l) => !sameValue(l, form[l.key], baseForm[l.key])) : LINES;
  const nextVersion = (active?.version ?? 0) + 1;

  function startEditing(from?: Draft) {
    setForm(toForm(from?.rules ?? active?.rules ?? loaded!.pending?.rules ?? CONTRACT_DEFAULTS));
    setErrors({}); setActionError(''); setSuccess(''); setEditing(true);
  }

  async function reviewChanges() {
    if (!form) return;
    setActionError(''); setBusy('save');
    try {
      const r = await saveDraft(form);
      if (r.errors) { setErrors(r.errors); return; }
      if (r.problem) { setActionError(r.problem); return; }
      if (r.draft) { setErrors({}); setAgreed(false); setReview(r.draft); }
    } finally { setBusy(null); }
  }

  async function activate() {
    if (!review || !digest) return;
    setActionError(''); setBusy('confirm');
    try {
      const r = await confirm(review, digest);
      if (r.problem) { setActionError(r.problem); if (r.stale) { setReview(null); setEditing(false); setForm(null); } return; }
      if (r.version) {
        setReview(null); setEditing(false); setForm(toForm(r.version.rules)); setAgreed(false);
        setSuccess(`Version ${r.version.version} is now your active rules. Confirmed ${formatUtc(r.version.confirmed_at)}.`);
        void refreshNeedsYou();
        requestAnimationFrame(() => heading.current?.focus());
      }
    } finally { setBusy(null); }
  }

  const reviewChangesList = review ? LINES.map((l) => ({ line: l, before: active ? baseForm[l.key] : null, after: toForm(review.rules)[l.key] }))
    .filter((c) => c.before === null || !sameValue(c.line, c.after, c.before)) : [];
  const unchanged = LINES.length + FIXED.length - reviewChangesList.length;

  return <Page width={760} className={editing ? styles.editingPage : undefined}>
    <div className={styles.head}>
      <PageHeader titleRef={heading} size="lg"
        eyebrow={editing ? (active ? `Draft · based on version ${active.version}` : 'First version') : active ? `Version ${active.version} · active` : 'No rules yet'}
        title={editing ? (active ? 'Edit your rules' : 'Set your rules') : active ? 'Your rules' : 'Set your rules'}
        subtitle={editing ? 'Change any value. Nothing takes effect until you review and confirm.' : active ? 'The AI follows these. Only you can change them.' : 'Nothing can be checked until you confirm your first rules.'} />
      {!editing && <Button kind={active ? 'secondary' : 'primary'} size="lg" onClick={() => startEditing()}>{active ? 'Edit rules' : 'Set up my rules'}</Button>}
    </div>

    {success && <p role="status" className={styles.success}><Icon name="check" size={16} />{success}</p>}
    {actionError && <Alert tone="danger" role="alert" title="Not saved" description={actionError} />}
    {!editing && loaded.pending && <Alert tone="info" title="You have a draft that is not active yet" description={`Saved ${formatUtc(loaded.pending.created_at)}. Nothing in it applies until you confirm it.`}
      action={{ label: 'Review this draft', onClick: () => { setAgreed(false); setReview(loaded.pending); } }} />}

    <form id="rules-form" noValidate onSubmit={(e) => { e.preventDefault(); void reviewChanges(); }} className={styles.groups} aria-label={editing ? 'Edit rules' : 'Active rules'}>
      {GROUPS.map((g) => <section key={g.key} className={styles.group} aria-label={g.title}>
        <h2 className={styles.groupTitle}><Icon name={g.icon} size={16} />{g.title}</h2>
        <ul className={styles.lines}>{LINES.filter((l) => l.group === g.key).map((l) => <RuleLine key={l.key} line={l} value={form[l.key]} base={active ? baseForm[l.key] : null} editing={editing} error={errors[l.key]}
          onChange={(v) => { setForm((f) => (f ? { ...f, [l.key]: v } : f)); setErrors((e) => ({ ...e, [l.key]: undefined })); }} />)}</ul>
      </section>)}
    </form>

    <p className={styles.always}>Also always true: {[
      `Base Sepolia testnet only (chain ${base.allowed_chain_id})`,
      base.new_recipient_requires_approval ? 'new recipients always need your OK' : null,
      base.borrowed_funding_forbidden ? 'borrowed money is never used' : null,
    ].filter(Boolean).join(' · ')}.</p>
    {!editing && <>
      <div className={styles.legend}>
        <span><Tag>Always</Tag>no exceptions, even with your OK</span>
        <span><Tag>Your OK</Tag>allowed if you approve</span>
        <span><Tag>Simulated</Tag>checked on simulated futures</span>
      </div>
      <div className={styles.versionRow}>
        {active ? <Status>Version {active.version} · confirmed by you on {day(active.confirmed_at)}</Status> : <Status state="attention">No version confirmed yet</Status>}
        <TextLink href="/rules/history">Version history</TextLink>
      </div>
    </>}

    {editing && <div className={styles.changeBar} role="region" aria-label="Unsaved changes">
      <strong aria-live="polite">{active ? `${changes.length} change${changes.length === 1 ? '' : 's'}` : 'New rules'}</strong>
      <TextLink onClick={() => { setEditing(false); setErrors({}); setForm(toForm(active?.rules ?? loaded.pending?.rules ?? CONTRACT_DEFAULTS)); }}>Discard</TextLink>
      <Button type="submit" form="rules-form" kind="primary" busy={busy === 'save'} disabled={Boolean(active) && changes.length === 0}>{busy === 'save' ? 'Saving draft…' : 'Review changes'}</Button>
    </div>}

    <Dialog open={Boolean(review)} onClose={() => { if (busy !== 'confirm') setReview(null); }} dismissible={busy !== 'confirm'} title="Make these your rules?" label="Review draft"
      description={<p>{reviewChangesList.length === 0 ? 'This draft changes nothing compared with your active rules.' : `${active ? `${reviewChangesList.length} rule${reviewChangesList.length === 1 ? '' : 's'} change.` : 'These become your first rules.'}${active ? ` The other ${unchanged} rules stay the same.` : ''}`}</p>}
      footer={<>
        <Button kind="secondary" size="lg" disabled={busy === 'confirm'} onClick={() => { if (review) startEditing(review); setReview(null); }}>Keep editing</Button>
        <Button kind="primary" size="lg" disabled={!agreed || !digest} busy={busy === 'confirm'} onClick={() => void activate()}>{busy === 'confirm' ? 'Activating…' : 'Activate'}</Button>
      </>}>
      {review && <section className={styles.review} aria-label="Changes">
        {active && reviewChangesList.length > 0 && <ul className={styles.changes}>{reviewChangesList.map((c) => <li key={c.line.key}>
          <span>{c.line.change}</span>
          <span className={styles.changeValues}><span>{c.before !== null ? changeValue(c.line, c.before) : 'Not set'}</span><span aria-hidden>→</span><strong>{changeValue(c.line, c.after)}</strong></span>
        </li>)}</ul>}
        {!active && <ul className={styles.changes}>{LINES.map((l) => <li key={l.key}><span>{l.change}</span><span className={styles.changeValues}><strong>{changeValue(l, toForm(review.rules)[l.key])}</strong></span></li>)}</ul>}
        {active && <p className={styles.reviewWarning}>Approvals you have not sent yet will stop working.</p>}
        <p className={styles.fingerprint}>Fingerprint (SHA-256) {digest ? <code data-testid="draft-digest">{digest}</code> : digestError ? null : 'computing…'}</p>
        {digestError && <p role="alert" className="t-body-1 c-danger">{digestError}</p>}
        {addressList(toForm(review.rules).known_recipients).length === 0 && <p className="t-body-1 c-low">No known addresses: every recipient will need your OK.</p>}
      </section>}
      <Checkbox checked={agreed} disabled={busy === 'confirm'} onChange={(e) => setAgreed(e.target.checked)}>Yes, make these my rules (version {nextVersion}).</Checkbox>
    </Dialog>
  </Page>;
}
