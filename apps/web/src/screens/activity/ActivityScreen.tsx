'use client';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useActivity, type Category } from '@/lib/activity';
import { formatUsd, shortAddress } from '@/lib/format';
import { countdown } from '@/lib/money';
import { Page } from '@/shell/AppFrame';
import { useApp } from '@/shell/AppContext';
import { Button, TextLink } from '@/ui/Button';
import { FilterChip } from '@/ui/form';
import { ActivityRow, Alert, EdgeCard, PageHeader, Skeleton, Status } from '@/ui/kit';
import { useEffect } from 'react';
import styles from './activity.module.css';

type Filter = 'all' | Exclude<Category, 'other'>;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'needs-you', label: 'Needs you' }, { key: 'money', label: 'Money moved' }, { key: 'blocked', label: 'Blocked' }, { key: 'rules', label: 'Rule changes' },
];

const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const timeOf = (iso: string) => new Date(iso).toISOString().slice(11, 16);
function dayLabel(key: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (key === today) return 'Today';
  return new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/** Figma "15 Activity": what happened, in plain words, every step linked and re-checked in the browser. */
export function ActivityScreen() {
  const { needsYou } = useApp();
  const initial = useSearchParams().get('filter');
  const { data, error, reload } = useActivity(needsYou.map((n) => n.certificateId));
  const [filter, setFilter] = useState<Filter>(initial === 'needs-you' ? 'needs-you' : 'all');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!needsYou.length) return; const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, [needsYou.length]);

  const items = useMemo(() => (data?.items ?? []).filter((i) => filter === 'all' || i.category === filter), [data, filter]);
  const groups = useMemo(() => {
    const out: { key: string; items: typeof items }[] = [];
    for (const item of items) {
      const k = dayKey(item.at);
      const last = out[out.length - 1];
      if (last && last.key === k) last.items.push(item); else out.push({ key: k, items: [item] });
    }
    return out;
  }, [items]);

  function download() {
    if (!data) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(data.events, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `prooffi-audit-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const counts = (key: Filter) => (key === 'all' ? undefined : (data?.items ?? []).filter((i) => i.category === key).length);
  const check = data?.check;

  return <Page width={880}>
    <div className={styles.head}>
      <PageHeader eyebrow="Everything that happened" title="Activity" subtitle="In plain words. Every step is linked and re-checked in your browser." />
      <div className={styles.headActions}>
        <TextLink href="/activity/check">Check a certificate</TextLink>
        <Button kind="secondary" size="lg" href="/security">Run security test</Button>
      </div>
    </div>

    <div className={styles.integrity}>
      {!data && !error ? <Status state="pending">Re-checking the record…</Status>
        : check?.ok ? <Status state="pass"><span data-testid="chain-status">Record intact · all {check.checked} events re-checked</span></Status>
        : check ? <Status state="fail"><span data-testid="chain-status">Record broken at event {check.sequence}</span></Status> : null}
      {data && <TextLink onClick={download}>Download</TextLink>}
    </div>
    {check && !check.ok && <EdgeCard where="Activity" tone="danger" title="The record does not add up" description={<><p>Event {check.sequence}: {check.reason}</p><p>Nothing has been changed by this screen. Keep the downloaded copy as evidence.</p></>} action={<Button kind="secondary" onClick={download}>Download the record</Button>} />}

    {error && <Alert tone="danger" role="alert" title="Activity could not be loaded" description={error} action={{ label: 'Try again', onClick: () => void reload() }} />}

    <div className={styles.filters} role="group" aria-label="Filter">
      {FILTERS.map((f) => <FilterChip key={f.key} selected={filter === f.key} onClick={() => setFilter(f.key)} count={f.key === 'needs-you' && counts(f.key) ? counts(f.key) : undefined}>{f.label}</FilterChip>)}
    </div>

    {!data && !error && <div className={styles.skeletons}><Skeleton height={60} /><Skeleton height={60} /><Skeleton height={60} /><Skeleton height={60} /></div>}
    {data && groups.length === 0 && <p className="t-body-2 c-med" role="status">{data.events.length === 0 ? 'Nothing has happened yet. Ask ProofFi a question to start the record.' : filter === 'all' ? 'Nothing to show.' : 'Nothing here yet.'}</p>}
    {groups.map((g) => <section key={g.key} className={styles.group} aria-label={dayLabel(g.key)}>
      <h2 className={styles.day}>{dayLabel(g.key)}</h2>
      {g.items.map((item, i) => {
        const need = needsYou.find((n) => n.certificateId === item.certificateId);
        const remaining = need ? countdown(need.expiresAt, now) : null;
        return item.needsYou && need
          ? <ActivityRow key={item.key} index={i} kind="needs-you" icon="bell" title={item.title} description={`Send ${formatUsd(need.amountMinor)} to ${shortAddress(need.recipient)}${remaining ? ` · expires in ${remaining}` : ' · expired'}`}
            trailing={<Button kind="primary" href={item.href ?? '/approve'}>Review</Button>} testId="activity-row" at={item.at} />
          : <ActivityRow key={item.key} index={i} icon={item.icon} title={item.title} description={item.description} href={item.href} meta={timeOf(item.at)} testId="activity-row" at={item.at} />;
      })}
    </section>)}
  </Page>;
}
