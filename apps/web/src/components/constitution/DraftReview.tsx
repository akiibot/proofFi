import { useEffect, useState } from 'react';
import { canonicalDigest } from '@/lib/canonical';
import { formatUtc } from '@/lib/format';
import { diff, type Draft, type Version } from './rules';

type Props = { draft: Draft; active: Version | null; busy: boolean; onConfirm: (digest: string) => void; onEdit: () => void };

/** Shows exactly what would change, then asks for an explicit, separate confirmation of these exact rules. */
export function DraftReview({ draft, active, busy, onConfirm, onEdit }: Props) {
  const [digest, setDigest] = useState<string | null>(null);
  const [digestError, setDigestError] = useState('');
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    let current = true;
    canonicalDigest(draft.rules)
      .then((value) => { if (current) { setDigest(value); setDigestError(''); } })
      .catch(() => { if (current) setDigestError('This browser could not compute the policy fingerprint, so the draft cannot be confirmed here.'); });
    return () => { current = false; };
  }, [draft]);

  const changes = diff(draft.rules, active?.rules ?? null);
  const changed = changes.filter((c) => c.changed);
  return <section className="review" aria-label="Review draft">
    <h2>Review the draft</h2>
    <p>Draft <code>{draft.id}</code>, saved {formatUtc(draft.created_at)}. {active ? `Compared with active version ${active.version}.` : 'No version is active yet, so every rule is new.'}</p>
    <div className="table-scroll">
      <table>
        <thead><tr><th scope="col">Rule</th><th scope="col">Active now</th><th scope="col">In this draft</th></tr></thead>
        <tbody>
          {changes.map((c) => <tr key={c.label} className={c.changed ? 'changed' : undefined}>
            <th scope="row">{c.label}{c.changed && <span className="sr-only"> (changed)</span>}</th><td>{c.before}</td><td>{c.after}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
    <p aria-live="polite">{changed.length === 0 ? 'This draft changes nothing compared with the active version.' : `${changed.length} rule${changed.length === 1 ? '' : 's'} would change.`}</p>

    <div className="confirm-box">
      <p>Policy fingerprint (SHA-256) of these exact rules: {digest ? <code data-testid="draft-digest">{digest}</code> : digestError ? null : 'computing…'}</p>
      {digestError && <p role="alert" className="notice">{digestError}</p>}
      <label className="check">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        I have reviewed these exact rules and want them to become my active Constitution.
      </label>
      <div className="actions">
        <button type="button" disabled={!agreed || !digest || busy} onClick={() => digest && onConfirm(digest)}>{busy ? 'Confirming…' : 'Confirm and activate'}</button>
        <button type="button" className="secondary" onClick={onEdit} disabled={busy}>Edit again</button>
      </div>
    </div>
  </section>;
}
