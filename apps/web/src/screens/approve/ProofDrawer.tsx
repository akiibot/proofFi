'use client';
import { formatUsd, formatUtc } from '@/lib/format';
import { bpsToPercent } from '@/lib/units';
import { statusMeaning, type ActionCertificate, type CertificateStatus } from '@/components/certificates/status';
import { TransactionFields } from '@/components/certificates/CertificateDetails';
import { Disclosure, KeyValue, KeyValueList, Status } from '@/ui/kit';
import { Drawer } from '@/ui/overlay';
import { FOLDED_LABEL, proofRows } from './proof';
import styles from './approve.module.css';

type Props = { open: boolean; onClose: () => void; certificate: ActionCertificate; status: CertificateStatus | null };

/** Figma "10 Proof": the plain verdict first, the exact bytes and hashes one click further. */
export function ProofDrawer({ open, onClose, certificate, status }: Props) {
  const p = certificate.payload;
  const { rows, passed, needOk, folded } = proofRows(certificate);
  const meaning = status ? statusMeaning(status.status) : null;
  const total = p.verdict.checks.length;
  const sim = p.simulation;
  return <Drawer open={open} onClose={onClose} title="Proof">
    <section className={styles.proof} aria-label="Proof">
      <div className={styles.verdict}>
        <Status state={!status ? 'pending' : meaning?.tone === 'bad' ? 'fail' : meaning?.tone === 'warn' ? 'attention' : 'pass'}>
          {status ? `${meaning?.title}${status.signature_valid ? ' · signed by the independent checker' : ' · signature not verified'}` : 'Checking…'}
        </Status>
      </div>
      <p className="t-overline c-low">Your rules · {passed} passed{needOk ? ` · ${needOk} need your OK` : ''}</p>
      <KeyValueList label="Rule checks">
        {rows.map((r) => <KeyValue key={r.key} label={r.label} value={<span className={r.kind === 'fail' ? styles.fail : undefined}>{r.value}</span>} />)}
        {folded.count > 0 && <KeyValue label={FOLDED_LABEL} value={folded.allPass ? `✓ ${folded.count} more` : 'Needs a look'} />}
      </KeyValueList>
      <div className={styles.more}>
        <Disclosure title={`Simulation · ${sim.config.path_count.toLocaleString('en-US')} futures · seed ${sim.config.seed}`}>
          <KeyValueList>
            <KeyValue label="Tuition paid" value={`${bpsToPercent(sim.metrics.goal_satisfaction_probability_bps)}% of futures`} />
            <KeyValue label="Floor broken" value={`${bpsToPercent(sim.metrics.reserve_breach_probability_bps)}% of futures`} />
            <KeyValue label="Worst 5% left" value={formatUsd(sim.metrics.p05_terminal_liquidity_minor)} />
            <KeyValue label="Average left" value={formatUsd(sim.metrics.expected_terminal_value_minor)} />
            <KeyValue label="Config fingerprint" mono value={<span title={sim.config_digest}>{sim.config_digest.slice(0, 12)}…</span>} />
          </KeyValueList>
        </Disclosure>
        <Disclosure title="Exact transaction the executor will sign">
          <TransactionFields certificate={certificate} />
        </Disclosure>
        <Disclosure title="Signature, hashes and versions">
          <KeyValueList>
            <KeyValue label="Certificate" mono value={p.id} />
            <KeyValue label="Certificate hash" mono value={certificate.certificate_hash} />
            <KeyValue label="Verifier key" mono value={certificate.key_id} />
            <KeyValue label="Rules version" mono value={p.constitution_version} />
            <KeyValue label="Policy fingerprint" mono value={p.policy_digest} />
            <KeyValue label="State" mono value={`Version ${p.state_version} · ${p.state_snapshot_hash}`} />
            <KeyValue label="Issued" value={formatUtc(p.issued_at)} />
            <KeyValue label="Expires" value={formatUtc(p.expires_at)} />
            <KeyValue label="Nonce" mono value={p.nonce} />
          </KeyValueList>
          {status && status.reasons.length > 0 && <p>Backend notes: {status.reasons.join('; ')}.</p>}
        </Disclosure>
      </div>
      <p className="t-body-1 c-low">{total} rules checked. Approving can never override a broken rule.</p>
    </section>
  </Drawer>;
}
