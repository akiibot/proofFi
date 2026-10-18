'use client';
import { useState, type CSSProperties } from 'react';
import { formatUtc, shortAddress } from '@/lib/format';
import { toForm, type Version } from '@/components/constitution/rules';
import { Page } from '@/shell/AppFrame';
import { cx } from '@/ui/cx';
import { Button, TextLink } from '@/ui/Button';
import { EdgeCard, KeyValue, KeyValueList, PageHeader, Skeleton, Tag } from '@/ui/kit';
import { changeValue, LINES, sameValue } from './lines';
import { useConstitution } from './useConstitution';
import styles from './rules.module.css';

function changesBetween(next: Version, previous: Version | null) {
  const after = toForm(next.rules);
  if (!previous) return LINES.map((l) => ({ line: l, before: null as string | null, after: after[l.key] }));
  const before = toForm(previous.rules);
  return LINES.filter((l) => !sameValue(l, after[l.key], before[l.key])).map((l) => ({ line: l, before: before[l.key] as string | null, after: after[l.key] }));
}

function VersionCard({ version, previous, active, index }: { version: Version; previous: Version | null; active: boolean; index: number }) {
  const [open, setOpen] = useState(false);
  const changes = changesBetween(version, previous);
  const who = version.confirmed_by === 'demo-user' ? 'you' : version.confirmed_by;
  return <li className={cx(styles.version, active ? styles.versionActive : styles.versionSuperseded, 'rise')} style={{ '--i': index } as CSSProperties} aria-label={`Version ${version.version}`}>
    <h2 className={styles.versionTitle}>Version {version.version}<Tag tone={active ? 'success' : 'outline'}>{active ? 'Active' : 'Superseded'}</Tag></h2>
    <KeyValueList>
      <KeyValue label="Confirmed" value={`By ${who} · ${formatUtc(version.confirmed_at)}`} />
      <KeyValue label="What changed" value={previous ? (changes.length ? `${changes.length} value${changes.length === 1 ? '' : 's'}, compared with version ${previous.version}` : `Nothing, compared with version ${previous.version}`) : 'Your first rules'} />
      <KeyValue label="Used for" value={active ? 'Every new certificate is checked against this version' : 'Nothing now. Certificates signed under it are out of date'} />
      <KeyValue label="ID" mono value={<span title={version.id}>{shortAddress(version.id)}</span>} />
      <KeyValue label="Policy fingerprint" mono value={<span title={version.policy_digest}>{version.policy_digest.slice(0, 12)}…{version.policy_digest.slice(-7)}</span>} />
    </KeyValueList>
    <TextLink onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : previous ? `Compare with version ${previous.version}` : 'See these rules'}</TextLink>
    {open && <ul className={styles.versionDiff}>
      {changes.length === 0 && <li>No rule values changed.</li>}
      {changes.map((c) => <li key={c.line.key}>{c.line.number}. {c.line.change}: {c.before !== null && <>{changeValue(c.line, c.before)} → </>}<strong>{changeValue(c.line, c.after)}</strong></li>)}
    </ul>}
  </li>;
}

/** Figma "12b Version history": every confirmed version; old ones are kept as they were. */
export function HistoryScreen() {
  const { loaded, loadError, load } = useConstitution();
  if (loadError) return <Page width={760}><EdgeCard where="Rules" title="Version history could not be loaded" description={loadError} action={<Button kind="secondary" onClick={() => void load()}>Try again</Button>} /></Page>;
  const ordered = loaded ? [...loaded.history].sort((a, b) => b.version - a.version) : [];
  return <Page width={760}>
    <Button kind="flat" size="sm" leftIcon="chevron-left" href="/rules" className={styles.back}>Your rules</Button>
    <PageHeader eyebrow="Version history" title="Version history" subtitle="Every version you confirmed. Old versions are kept as they were and can never be edited or used again." />
    {!loaded ? <div className={styles.loading} role="status" aria-label="Loading version history"><Skeleton height={220} radius={12} /><Skeleton height={220} radius={12} /></div>
      : ordered.length === 0 ? <EdgeCard where="Rules" role="status" title="No version confirmed yet" description="Your first confirmed rules will appear here." action={<Button kind="primary" href="/rules">Set my rules</Button>} />
      : <ol className={styles.versions}>{ordered.map((v, i) => <VersionCard key={v.id} index={i} version={v} previous={ordered[i + 1] ?? null} active={v.id === loaded.activeId} />)}</ol>}
  </Page>;
}
