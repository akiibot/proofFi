import { formatUtc } from '@/lib/format';
import { describe, FIELDS, FIXED, type Version } from './rules';

export function ActiveVersion({ active }: { active: Version | null }) {
  if (!active) {
    return <section className="active-version" aria-label="Active Constitution">
      <h2>Active Constitution</h2>
      <p className="notice">No Constitution is active yet. Until one is confirmed, no action can be verified.</p>
    </section>;
  }
  return <section className="active-version" aria-label="Active Constitution">
    <h2>Active Constitution: version {active.version}</h2>
    <p>Confirmed {formatUtc(active.confirmed_at)} by {active.confirmed_by}. Fingerprint <code>{active.policy_digest}</code></p>
    <dl className="rule-list">
      {FIELDS.map((f) => <div key={f.key}><dt>{f.label}</dt><dd>{describe(f, active.rules)}</dd></div>)}
      {FIXED.map((f) => <div key={f.key}><dt>{f.label}</dt><dd>{f.describe(active.rules)}</dd></div>)}
    </dl>
  </section>;
}

export function VersionHistory({ versions, activeId }: { versions: Version[]; activeId: string | null }) {
  const newest = [...versions].sort((a, b) => b.version - a.version);
  return <section className="history" aria-label="Version history">
    <h2>Version history</h2>
    {newest.length === 0
      ? <p>No version has been confirmed yet.</p>
      : <div className="table-scroll"><table>
        <thead><tr><th scope="col">Version</th><th scope="col">Confirmed</th><th scope="col">Fingerprint</th><th scope="col">Status</th></tr></thead>
        <tbody>{newest.map((v) => <tr key={v.id}>
          <td>{v.version}</td><td>{formatUtc(v.confirmed_at)}</td><td><code title={v.policy_digest}>{v.policy_digest.slice(0, 12)}…</code></td>
          <td>{v.id === activeId ? 'Active' : 'Superseded'}</td>
        </tr>)}</tbody>
      </table></div>}
    <p className="hint">Confirmed versions are never edited. A change always creates a new version.</p>
  </section>;
}
