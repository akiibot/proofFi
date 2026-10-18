'use client';
import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cx } from './cx';
import { Icon } from './Icon';
import styles from './form.module.css';

type FieldShell = { id: string; label: ReactNode; help?: ReactNode; error?: string; mono?: boolean; className?: string; hideLabel?: boolean };

function describedBy(id: string, help?: ReactNode, error?: string) {
  return [help ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
}

function Shell({ id, label, help, error, className, hideLabel, children }: FieldShell & { children: ReactNode }) {
  return <div className={cx(styles.field, error && styles.hasError, className)}>
    <label htmlFor={id} className={cx(styles.label, hideLabel && 'sr-only')}>{label}</label>
    {children}
    {help && !error && <small id={`${id}-help`} className={styles.help}>{help}</small>}
    {help && error && <small id={`${id}-help`} className="sr-only">{help}</small>}
    {error && <small id={`${id}-error`} className={styles.error} role="alert">{error}</small>}
  </div>;
}

type InputProps = FieldShell & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'>;

/** Figma "Input" (34:169): 48px field, yellow border and soft ring on focus, red on error. */
export const Field = forwardRef<HTMLInputElement, InputProps>(function Field({ id, label, help, error, mono, className, hideLabel, ...rest }, ref) {
  return <Shell id={id} label={label} help={help} error={error} className={className} hideLabel={hideLabel}>
    <input ref={ref} id={id} {...rest} className={cx(styles.control, mono && styles.mono)} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, help, error)} />
  </Shell>;
});

type AreaProps = FieldShell & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className'>;

export const TextArea = forwardRef<HTMLTextAreaElement, AreaProps>(function TextArea({ id, label, help, error, mono, className, hideLabel, ...rest }, ref) {
  return <Shell id={id} label={label} help={help} error={error} className={className} hideLabel={hideLabel}>
    <textarea ref={ref} id={id} {...rest} className={cx(styles.control, styles.area, mono && styles.mono)} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, help, error)} />
  </Shell>;
});

type CheckProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & { children: ReactNode; className?: string };

/** Figma "Checkbox" (34:143): a real checkbox (so labels and keyboard work) drawn as the 20px box. */
export function Checkbox({ children, className, ...rest }: CheckProps) {
  return <label className={cx(styles.check, rest.disabled && styles.checkDisabled, className)}>
    <input type="checkbox" {...rest} className={styles.checkInput} />
    <span className={styles.box} aria-hidden><Icon name="check" size={12} /></span>
    <span className={styles.checkLabel}>{children}</span>
  </label>;
}

/** Figma "Suggestion chip" (34:197). */
export function SuggestionChip({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className={styles.chip} onClick={onClick} disabled={disabled}>{children}</button>;
}

/** Figma "Filter chip" (34:192). Selected is the only filled state. */
export function FilterChip({ selected, onClick, children, count }: { selected: boolean; onClick: () => void; children: ReactNode; count?: number }) {
  return <button type="button" className={cx(styles.filter, selected && styles.filterOn)} aria-pressed={selected} onClick={onClick}>
    {children}{count !== undefined && <span className={styles.filterCount}>{count}</span>}
  </button>;
}
