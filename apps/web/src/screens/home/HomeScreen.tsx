'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useActivity } from '@/lib/activity';
import { formatUsd, shortAddress } from '@/lib/format';
import { buckets, clock, countdown, greeting } from '@/lib/money';
import { run, writeHeaders } from '@/lib/request';
import { recallSafe } from '@/lib/safe-memory';
import { minorToInput } from '@/lib/units';
import { useActivePolicy } from '@/lib/use-active-policy';
import { Page } from '@/shell/AppFrame';
import { useApp } from '@/shell/AppContext';
import { Button, TextLink } from '@/ui/Button';
import { ActivityRow, Alert, AllocationBar, PageHeader, Skeleton, Stat, Status } from '@/ui/kit';
import { Tour } from '@/tour/Tour';
import { HOME_TOUR, tourSeen, tourTarget, type TourStep } from '@/tour/steps';
import { EMERGENCY_MINOR, RecordExpense, type EmergencyResponse } from './RecordExpense';
import styles from './home.module.css';

type AfterExpense = { result: EmergencyResponse; beforeMinor: number | null; freeBeforeMinor: number | null; staleApproval: { amountMinor: number; status: string } | null };

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!active) return; const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, [active]);
  return now;
}

/** Figma "03 Home" and "20 Home after expense": is my money safe, and does anything need me? */
export function HomeScreen() {
  const { policy, error, reload } = useActivePolicy();
  const { chain, chainProblem, needsYou, refreshNeedsYou, tourPending, clearTourPending } = useApp();
  const { data: activity, reload: reloadActivity } = useActivity(needsYou.map((n) => n.certificateId));
  const [checked, setChecked] = useState<Date | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [after, setAfter] = useState<AfterExpense | null>(null);
  const first = needsYou[0];
  const now = useNow(Boolean(first));

  useEffect(() => { if (policy) setChecked(new Date()); }, [policy]);

  const b = useMemo(() => (policy ? buckets(policy.state, policy.active?.rules ?? null) : null), [policy]);
  const obligation = b?.obligationNames[0]?.toLowerCase() ?? 'protected money';

  // First-run tour: starts once on its own (never under browser automation), or again from the account menu.
  const [tourSteps, setTourSteps] = useState<TourStep[] | null>(null);
  const ready = Boolean(policy && b);
  const startTour = useCallback(() => { const steps = HOME_TOUR.filter((s) => tourTarget(s.target)); if (steps.length) setTourSteps(steps); }, []);
  useEffect(() => {
    if (!ready || tourSeen() || navigator.webdriver) return;
    const timer = window.setTimeout(startTour, 900);
    return () => window.clearTimeout(timer);
  }, [ready, startTour]);
  useEffect(() => {
    if (!ready || !tourPending) return;
    const timer = window.setTimeout(() => { clearTourPending(); startTour(); }, 300);
    return () => window.clearTimeout(timer);
  }, [ready, tourPending, clearTourPending, startTour]);

  async function recorded(result: EmergencyResponse, fromVersion: number) {
    setExpenseOpen(false);
    const remembered = recallSafe();
    let staleApproval: AfterExpense['staleApproval'] = null;
    if (first) {
      try {
        const headers = await writeHeaders();
        const s = await run(() => api.POST('/certificates/{id}/verify', { params: { path: { id: first.certificateId } }, headers }));
        if (s.ok && s.data.status !== 'VALID' && s.data.status !== 'APPROVAL_REQUIRED') staleApproval = { amountMinor: first.amountMinor, status: s.data.status };
      } catch { /* the stale notice is only shown when the backend confirms it */ }
    }
    setAfter({ result, beforeMinor: remembered && remembered.stateVersion === fromVersion ? remembered.amountMinor : null, freeBeforeMinor: b?.freeMinor ?? null, staleApproval });
    void reload(); void refreshNeedsYou(); void reloadActivity();
  }

  if (error) return <Page>
    <PageHeader eyebrow={greeting()} title="We could not load your money." subtitle={error} />
    <Alert tone="danger" role="alert" title="Home is unavailable right now" description="Nothing was changed. Your rules and money are as you left them." action={{ label: 'Try again', onClick: () => void reload() }} />
  </Page>;

  if (!policy || !b) return <Page>
    <div className={styles.loading} role="status" aria-label="Loading your money">
      <Skeleton width={120} height={20} /><Skeleton width="55%" height={52} radius={12} /><Skeleton width="45%" height={20} />
      <div className={styles.twoNumbers}><Skeleton height={120} radius={16} /><Skeleton height={120} radius={16} /></div>
      <Skeleton height={10} radius={5} />
    </div>
  </Page>;

  const active = policy.active;
  const needsAttention = b.freeMinor < 0 || b.liquidMinor < b.protectedMinor;
  const title = !active ? `Set your rules to protect your ${obligation}.` : needsAttention ? 'Your budget needs attention.' : 'Your commitments are set aside.';
  const subtitle = after
    ? `You recorded a ${formatUsd(EMERGENCY_MINOR)} expense. Your rules stayed the same; your limit was recalculated.`
    : !active ? 'Your money is below. Your rules decide what Vallet may ever do with it.'
    : b.freeMinor < 0 ? `Your planning budget is ${formatUsd(-b.freeMinor)} short of covering protected money and living costs, before fees or shocks.`
    : needsAttention ? 'Your eligible cash is below what your rules protect. Ask Vallet to check the current limits.'
    : `These are current planning balances, before fees and risk checks.${checked ? ` Last loaded ${clock(checked)}.` : ''} Ask Vallet to check a proposed amount.`;
  const afterOpt = after?.result.optimization;
  const afterSafe = afterOpt?.status === 'SAFE_ACTION' ? afterOpt.max_amount_minor : null;
  const remaining = first ? countdown(first.expiresAt, now) : null;
  const recent = (activity?.items ?? []).filter((i) => !i.needsYou).slice(0, 3);

  return <Page>
    <PageHeader eyebrow={greeting()} title={title} subtitle={subtitle} tour="verdict" />

    {!active && <Alert tone="needs-you" title="No rules yet" description="Nothing can be checked until you set your rules." action={{ label: 'Set my rules', href: '/rules' }} />}

    {after && <section className={styles.whatChanged} aria-label="What changed" data-testid="emergency-result">
      {after.beforeMinor !== null && <><div className={styles.before}><span>Safe to invest before</span><strong className="t-h3 tabular">{formatUsd(after.beforeMinor)}</strong></div>
        <span className={styles.arrow} aria-hidden>→</span></>}
      <div className={styles.after}><span>Safe to invest now</span><strong className="t-h3 tabular">{afterSafe !== null ? formatUsd(afterSafe) : 'Nothing'}</strong></div>
      <div className={styles.afterAction}>
        {afterSafe !== null && afterSafe > 0 && <Button kind="primary" size="lg" href={`/ask?amount=${minorToInput(afterSafe)}`}>Check {formatUsd(afterSafe)} now</Button>}
        {after.staleApproval && <p>Your unsent {formatUsd(after.staleApproval.amountMinor)} approval no longer works.</p>}
        {afterOpt?.status !== 'SAFE_ACTION' && <p>{afterOpt?.status === 'NO_SAFE_ACTION' ? 'Even $1 would break your rules now.' : 'No single safe limit can be trusted right now.'}</p>}
      </div>
    </section>}

    {first && !after && <Alert tone="needs-you" tour="needs-you" title={first.status === 'APPROVAL_REQUIRED' ? '1 approval waiting' : '1 payment ready to send'}
      description={`Send ${formatUsd(first.amountMinor)} to ${shortAddress(first.recipient)}${remaining ? ` · expires in ${remaining}` : ' · expired'}`}
      action={{ label: 'Review', href: `/approve?id=${encodeURIComponent(first.certificateId)}` }} />}

    <div className={styles.twoNumbers} data-tour="money">
      <Stat icon="lock" label="Protected" value={formatUsd(b.protectedMinor)} testId="protected-total"
        description={b.floorMinor !== null
          ? `${formatUsd(b.obligationsMinor)} for your goal reserve and other protected obligations, plus your ${formatUsd(b.floorMinor)} emergency floor. Only liquid assets that are not high risk count toward protection.`
          : `${b.obligationNames.join(', ') || 'Obligations'} ${formatUsd(b.obligationsMinor)}. Set your rules to add an emergency floor.`} />
      <Stat icon="wallet" label={b.freeMinor < 0 ? "Budget shortfall" : "Uncommitted cash"} value={formatUsd(Math.abs(b.freeMinor))} testId="free-total"
        description={after?.freeBeforeMinor != null ? `Was ${formatUsd(after.freeBeforeMinor)} before the expense.` : b.freeMinor < 0 ? `Your ${formatUsd(b.liquidMinor)} planning cash is ${formatUsd(-b.freeMinor)} below your commitments. This is not a negative wallet balance; no amount is available before financial checks.` : 'Before fees and risk checks. Ask Vallet what is actually safe.'} />
    </div>

    <AllocationBar segments={[
      { label: 'protected', tone: 'protected', amountMinor: b.protectedMinor, caption: `Protected ${formatUsd(b.protectedMinor)}` },
      { label: 'living', tone: 'living', amountMinor: b.livingMinor, caption: `Living costs ${formatUsd(b.livingMinor)}` },
      { label: 'free', tone: 'free', amountMinor: Math.max(0, b.freeMinor), caption: b.freeMinor < 0 ? `Shortfall ${formatUsd(-b.freeMinor)}` : `Uncommitted ${formatUsd(b.freeMinor)}` },
    ]} />

    <div className={styles.actions} data-tour="actions">
      <Button kind="secondary" size="xl" leftIcon="ai" href="/ask">Ask Vallet</Button>
      <TextLink onClick={() => setExpenseOpen(true)}>Record an expense</TextLink>
    </div>

    <section className={styles.recent} aria-label="Recent">
      <div className={styles.recentHeader}><h2 className="t-title-1">Recent</h2><TextLink href="/activity">See all activity</TextLink></div>
      {!activity && <div className={styles.recentSkeleton}><Skeleton height={56} /><Skeleton height={56} /><Skeleton height={56} /></div>}
      {activity && recent.length === 0 && <p className="t-body-1 c-med">Nothing has happened yet. Ask Vallet a question to start.</p>}
      {recent.map((item, i) => <ActivityRow key={item.key} index={i} icon={item.icon} title={item.title} description={item.description} href={item.href} />)}
    </section>

    <div className={styles.quiet}>
      <Status state={active ? 'pass' : 'attention'}>{active ? `Rules v${active.version} active` : 'No rules active'}</Status>
      <Status state={chainProblem ? 'fail' : !chain ? 'pending' : chain.status === 'READY' ? 'pass' : 'attention'}>{chain?.status === 'READY' ? 'Chain ready' : chain ? 'Chain not ready' : chainProblem ? 'Chain unavailable' : 'Checking chain'}</Status>
      <Status state={!activity?.check ? 'pending' : activity.check.ok ? 'pass' : 'fail'}>{!activity?.check ? 'Checking record' : activity.check.ok ? 'Record intact' : 'Record broken'}</Status>
    </div>

    <RecordExpense open={expenseOpen} onClose={() => setExpenseOpen(false)} stateVersion={policy.state.snapshot.version}
      uncertain={uncertain} onUncertain={() => setUncertain(true)} onRecorded={(r, v) => void recorded(r, v)} onRefresh={() => void reload()} />
    {tourSteps && <Tour steps={tourSteps} onClose={() => setTourSteps(null)} />}
  </Page>;
}
