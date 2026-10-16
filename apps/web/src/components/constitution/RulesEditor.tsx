import { FIELDS, FIXED, type FormValues, type Rules } from './rules';

type Props = {
  form: FormValues;
  errors: Partial<Record<keyof FormValues, string>>;
  fixedFrom: Rules;
  busy: boolean;
  onChange: (key: keyof FormValues, value: string) => void;
  onSave: () => void;
};

/** Editing only creates a draft. Nothing here activates a rule. */
export function RulesEditor({ form, errors, fixedFrom, busy, onChange, onSave }: Props) {
  return <form className="rules-form" noValidate onSubmit={(event) => { event.preventDefault(); onSave(); }}>
    <div className="field-grid">
      {FIELDS.map((field) => {
        const id = `rule-${field.key}`;
        const error = errors[field.key];
        const describedBy = `${id}-help${error ? ` ${id}-error` : ''}`;
        const common = { id, name: field.key, value: form[field.key], 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy,
          onChange: (event: { target: { value: string } }) => onChange(field.key, event.target.value) };
        return <div key={field.key} className={`field${field.kind === 'addresses' ? ' field-wide' : ''}`}>
          <label htmlFor={id}>{field.label}{field.kind === 'usd' ? ' (USD)' : field.kind === 'bps' ? ' (%)' : ''}</label>
          {field.kind === 'addresses'
            ? <textarea {...common} rows={3} spellCheck={false} placeholder="0x…" />
            : <input {...common} inputMode="decimal" autoComplete="off" />}
          <small id={`${id}-help`}>{field.help}</small>
          {error && <small id={`${id}-error`} className="field-error">{error}</small>}
        </div>;
      })}
    </div>
    <dl className="fixed-rules" aria-label="Fixed rules">
      {FIXED.map((fixed) => <div key={fixed.key}><dt>{fixed.label}</dt><dd>{fixed.describe(fixedFrom)} <small>(fixed by ProofFi)</small></dd></div>)}
    </dl>
    <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</button>
    <p className="hint">Saving creates a draft for review. It does not change your active Constitution.</p>
  </form>;
}
