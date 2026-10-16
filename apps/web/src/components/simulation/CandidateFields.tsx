import type { CandidateErrors, CandidateForm } from '@/lib/candidate';

type Props = { form: CandidateForm; errors: CandidateErrors; onChange: (key: keyof CandidateForm, value: string) => void; idPrefix: string };

const FIELDS: { key: keyof CandidateForm; label: string; help: string; mono?: boolean }[] = [
  { key: 'amount', label: 'Amount (USD)', help: 'Synthetic USD to allocate to the test token.' },
  { key: 'token', label: 'Token address', help: 'Test token contract on Base Sepolia.', mono: true },
  { key: 'recipient', label: 'Recipient address', help: 'Destination for the test allocation.', mono: true },
];

/** The three fields of a manual candidate action, shared by the screens that let a person propose one. */
export function CandidateFields({ form, errors, onChange, idPrefix }: Props) {
  return <div className="field-grid">
    {FIELDS.map((f) => {
      const id = `${idPrefix}-${f.key}`;
      const error = errors[f.key];
      return <div key={f.key} className="field">
        <label htmlFor={id}>{f.label}</label>
        <input id={id} value={form[f.key]} onChange={(e) => onChange(f.key, e.target.value)} autoComplete="off" spellCheck={false}
          inputMode={f.key === 'amount' ? 'decimal' : 'text'} className={f.mono ? 'mono' : undefined}
          aria-invalid={error ? true : undefined} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} />
        <small id={`${id}-help`}>{f.help}</small>
        {error && <small id={`${id}-error`} className="field-error">{error}</small>}
      </div>;
    })}
  </div>;
}
