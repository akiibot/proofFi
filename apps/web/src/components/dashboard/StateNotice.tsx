type Props = { label: string; status: 'loading' | 'ready' | 'error'; message?: string; hasData: boolean; onRetry: () => void };

/** Loading and error messaging for one section. Shows nothing when the section is simply ready. */
export function StateNotice({ label, status, message, hasData, onRetry }: Props) {
  if (status === 'loading' && !hasData) return <p role="status" className="skeleton">Loading {label}…</p>;
  if (status === 'error') {
    return <div role="alert" className="notice">
      <p><strong>Could not load {label}.</strong> {message}</p>
      {hasData && <p>Showing the last data that loaded successfully.</p>}
      <button type="button" className="secondary" onClick={onRetry}>Try again</button>
    </div>;
  }
  return null;
}
