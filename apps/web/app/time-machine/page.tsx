'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { buildCandidate, type CandidateErrors, type CandidateForm } from '@/lib/candidate';
import { run, writeHeaders, type Problem } from '@/lib/request';
import { useActivePolicy } from '@/lib/use-active-policy';
import { AppShell } from '@/components/shell/AppShell';
import { CandidateFields } from '@/components/simulation/CandidateFields';
import { SimulationResult, type SimulationRun } from '@/components/simulation/SimulationResult';

function Unavailable({ problem }: { problem: Problem }) {
  const needsPolicy = /Constitution/i.test(problem.message);
  return <div role="alert" className="notice">
    <p><strong>The simulation could not run.</strong> {problem.message}</p>
    {needsPolicy && <p><a href="/constitution">Confirm a Constitution</a> first; simulations always run against your active rules.</p>}
    {/configuration/i.test(problem.message) && <p>No simulation assumptions have been approved yet, so ProofFi refuses to invent them.</p>}
  </div>;
}

export default function TimeMachinePage() {
  const router = useRouter();
  const { policy, error: loadError, reload } = useActivePolicy();
  const [form, setForm] = useState<CandidateForm>({ amount: '1000', token: '', recipient: '' });
  const [errors, setErrors] = useState<CandidateErrors>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SimulationRun | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);

  // A link from the Workspace may carry a candidate; it only fills the form and is validated like typed input.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const linked = { amount: query.get('amount'), token: query.get('token'), recipient: query.get('recipient') };
    if (linked.amount || linked.token || linked.recipient) {
      setForm((f) => ({ amount: linked.amount ?? f.amount, token: linked.token ?? f.token, recipient: linked.recipient ?? f.recipient }));
    }
  }, []);

  // Start from the first allowed token and known recipient of the active Constitution, when there are any.
  useEffect(() => {
    const rules = policy?.active?.rules;
    if (!rules) return;
    setForm((f) => ({ ...f, token: f.token || rules.allowed_tokens[0] || '', recipient: f.recipient || rules.known_recipients[0] || '' }));
  }, [policy]);

  async function simulate() {
    setProblem(null);
    const built = buildCandidate(form, 'Manual what-if entered on the Time Machine screen', 'whatif');
    if (!built.ok) { setErrors(built.errors); return; }
    setErrors({}); setBusy(true);
    try {
      const headers = await writeHeaders();
      const outcome = await run(() => api.POST('/simulate', { body: { action: built.action }, headers }));
      if (!outcome.ok) { if (outcome.expired) { router.replace('/login'); return; } setProblem(outcome.problem); return; }
      setResult(outcome.data);
    } catch { setProblem({ code: 'UNAUTHORIZED', message: 'Your session could not be checked. Sign in again and retry.', reasons: [], httpStatus: 0 }); }
    finally { setBusy(false); }
  }

  return <AppShell current="/time-machine">
    <section className="page-head">
      <p className="eyebrow">WHAT COULD HAPPEN</p>
      <h1>Time Machine</h1>
      <p>Run one proposed action through many seeded futures and see the named stress tests and every assumption behind them. Nothing here is executed or approved.</p>
    </section>

    {!policy && !loadError && <p role="status" className="skeleton">Loading your rules…</p>}
    {loadError && <div role="alert" className="notice"><p><strong>Could not load your rules.</strong> {loadError}</p><button type="button" className="secondary" onClick={() => void reload()}>Try again</button></div>}

    {policy && <section className="editor" aria-label="Proposed action">
      <h2>Proposed action</h2>
      {!policy.active && <p className="notice">No Constitution is active, so the backend will refuse to simulate. <a href="/constitution">Set one up</a>.</p>}
      <form noValidate onSubmit={(e) => { e.preventDefault(); void simulate(); }}>
        <CandidateFields form={form} errors={errors} idPrefix="whatif" onChange={(key, value) => { setForm((f) => ({ ...f, [key]: value })); setErrors((e) => ({ ...e, [key]: undefined })); }} />
        <div className="actions"><button type="submit" disabled={busy}>{busy ? 'Simulating…' : 'Run simulation'}</button></div>
      </form>
    </section>}

    {problem && <Unavailable problem={problem} />}
    {busy && <p role="status" className="skeleton">Running seeded futures…</p>}
    {result && !busy && <SimulationResult run={result} rules={policy?.active?.rules ?? null} />}
  </AppShell>;
}
