'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatUtc } from '@/lib/format';
import { run, writeHeaders, type Problem } from '@/lib/request';
import { AppShell } from '@/components/shell/AppShell';
import { RulesEditor } from '@/components/constitution/RulesEditor';
import { DraftReview } from '@/components/constitution/DraftReview';
import { ActiveVersion, VersionHistory } from '@/components/constitution/VersionPanels';
import { CONTRACT_DEFAULTS, fromForm, toForm, type Draft, type FormValues, type Rules, type Version } from '@/components/constitution/rules';

type Loaded = { activeId: string | null; active: Version | null; history: Version[]; pending: Draft | null };

function explain(problem: Problem): string {
  if (problem.code === 'STALE_POLICY') return 'Your active Constitution changed since this draft was made. Review the current version and create a new draft.';
  if (problem.code === 'VALIDATION_ERROR') return problem.reasons.length ? `The backend rejected these rules: ${problem.reasons.join('; ')}` : problem.message;
  return problem.message;
}

export default function ConstitutionPage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState<FormValues | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [review, setReview] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const latestLoad = useRef(0);

  const load = useCallback(async () => {
    const request = ++latestLoad.current;
    setLoadError('');
    const [state, history, drafts] = await Promise.all([
      run(() => api.GET('/financial-state')), run(() => api.GET('/constitutions/history')), run(() => api.GET('/constitutions/drafts')),
    ]);
    if (request !== latestLoad.current) return null;
    for (const outcome of [state, history, drafts]) {
      if (!outcome.ok && outcome.expired) { router.replace('/login'); return null; }
    }
    if (!state.ok || !history.ok || !drafts.ok) {
      const failed = [state, history, drafts].find((o) => !o.ok);
      setLoadError(failed && !failed.ok ? failed.problem.message : 'Unable to load the Constitution.');
      return null;
    }
    const activeId = state.data.active_constitution_version;
    const active = history.data.find((v) => v.id === activeId) ?? null;
    if (activeId && !active) { setLoadError('The active Constitution is missing from the version history. Nothing can be edited until this is resolved.'); return null; }
    // Only drafts made against the current active version can still be confirmed; older ones are stale.
    const pending = drafts.data.filter((d) => d.base_version === activeId).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
    const next = { activeId, active, history: history.data, pending };
    setLoaded(next);
    return next;
  }, [router]);

  const cancelLoads = useCallback(() => { ++latestLoad.current; }, []);
  useEffect(() => {
    void load().then((next) => { if (next) setForm(toForm(next.pending?.rules ?? next.active?.rules ?? CONTRACT_DEFAULTS)); });
    return cancelLoads;
  }, [load, cancelLoads]);

  const base: Rules = loaded?.active?.rules ?? CONTRACT_DEFAULTS;

  async function saveDraft() {
    if (!form || !loaded) return;
    setActionError(''); setSuccess('');
    const parsed = fromForm(form, base);
    if (!parsed.ok) { setErrors(parsed.errors); return; }
    setErrors({}); setBusy(true);
    try {
      const headers = await writeHeaders();
      const outcome = await run(() => api.POST('/constitutions/drafts', { body: { base_version: loaded.activeId, rules: parsed.rules }, headers }));
      if (!outcome.ok) { if (outcome.expired) { router.replace('/login'); return; } setActionError(explain(outcome.problem)); if (outcome.problem.code === 'STALE_POLICY') await load(); return; }
      setReview(outcome.data);
    } catch { setActionError('Your session could not be checked. Sign in again and retry.'); }
    finally { setBusy(false); }
  }

  async function confirm(digest: string) {
    if (!review) return;
    setActionError(''); setBusy(true);
    try {
      const headers = await writeHeaders();
      const outcome = await run(() => api.POST('/constitutions/confirm', { body: { draft_id: review.id, confirmed: true, expected_policy_digest: digest }, headers }));
      if (!outcome.ok) {
        if (outcome.expired) { router.replace('/login'); return; }
        setActionError(explain(outcome.problem));
        if (outcome.problem.code === 'STALE_POLICY') { setReview(null); const next = await load(); if (next) setForm(toForm(next.active?.rules ?? CONTRACT_DEFAULTS)); }
        return;
      }
      setReview(null);
      setSuccess(`Version ${outcome.data.version} is now your active Constitution. Confirmed ${formatUtc(outcome.data.confirmed_at)}.`);
      const next = await load();
      if (next) setForm(toForm(next.active?.rules ?? outcome.data.rules));
      headingRef.current?.focus();
    } catch { setActionError('Your session could not be checked. Sign in again and retry.'); }
    finally { setBusy(false); }
  }

  return <AppShell current="/constitution">
    <section className="page-head">
      <p className="eyebrow">YOUR RULES</p>
      <h1 ref={headingRef} tabIndex={-1}>Constitution</h1>
      <p>These rules decide what ProofFi may ever do with your money. The AI cannot change them. A change takes effect only after you review and confirm it.</p>
    </section>

    {!loaded && !loadError && <p role="status" className="skeleton">Loading your Constitution…</p>}
    {loadError && <div role="alert" className="notice"><p><strong>Could not load the Constitution.</strong> {loadError}</p><button type="button" className="secondary" onClick={() => void load()}>Try again</button></div>}
    {success && <p role="status" className="success">{success}</p>}
    {actionError && <p role="alert" className="notice">{actionError}</p>}

    {loaded && <>
      <ActiveVersion active={loaded.active} />

      {review
        ? <DraftReview draft={review} active={loaded.active} busy={busy} onConfirm={confirm} onEdit={() => { setForm(toForm(review.rules)); setReview(null); }} />
        : form && <section className="editor" aria-label="Edit rules">
          <h2>{loaded.active ? 'Propose a change' : 'Set up your first Constitution'}</h2>
          {loaded.pending && <div className="pending">
            <p>You have an unconfirmed draft from {formatUtc(loaded.pending.created_at)}. The form below starts from it.</p>
            <button type="button" className="secondary" onClick={() => setReview(loaded.pending)}>Review this draft</button>
          </div>}
          <RulesEditor form={form} errors={errors} fixedFrom={base} busy={busy}
            onChange={(key, value) => { setForm((f) => (f ? { ...f, [key]: value } : f)); setErrors((e) => ({ ...e, [key]: undefined })); }}
            onSave={saveDraft} />
        </section>}

      <VersionHistory versions={loaded.history} activeId={loaded.activeId} />
    </>}
  </AppShell>;
}
