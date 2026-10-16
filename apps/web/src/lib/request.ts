import { csrfHeaders } from './session';

/** One independently loaded piece of a page. `data` is kept from the last success so a failed refresh does not blank the screen. */
export type Slice<T> = { status: 'loading' | 'ready' | 'error'; data?: T; message?: string; code?: string };

/** The error envelope every backend route uses: {code, message, reasons}. */
export type Problem = { code: string; message: string; reasons: string[]; httpStatus: number };

type Call<T> = () => Promise<{ data?: T; error?: unknown; response: Response }>;

export function problemFrom(error: unknown, httpStatus: number, fallback: string): Problem {
  const value = (typeof error === 'object' && error !== null ? error : {}) as Record<string, unknown>;
  return {
    code: typeof value.code === 'string' ? value.code : httpStatus === 0 ? 'NETWORK' : `HTTP_${httpStatus}`,
    message: typeof value.message === 'string' ? value.message : fallback,
    reasons: Array.isArray(value.reasons) ? value.reasons.filter((r): r is string => typeof r === 'string') : [],
    httpStatus,
  };
}

/** The backend says the feature exists in the contract but is not built yet (HTTP 501). */
export const isNotImplemented = (problem: Problem) => problem.code === 'NOT_IMPLEMENTED' || problem.httpStatus === 501;

export type Outcome<T> = { ok: true; data: T } | { ok: false; expired: boolean; problem: Problem };

/** Runs one typed API call and folds every failure (HTTP error, bad JSON, network) into a Problem. 401 sets `expired`. */
export async function run<T>(call: Call<T>, fallback = 'The backend is unavailable.'): Promise<Outcome<T>> {
  try {
    const { data, error, response } = await call();
    if (response.status === 401) return { ok: false, expired: true, problem: problemFrom(error, 401, 'Your session expired.') };
    if (error !== undefined || data === undefined) return { ok: false, expired: false, problem: problemFrom(error, response.status, fallback) };
    return { ok: true, data };
  } catch (cause) {
    return { ok: false, expired: false, problem: problemFrom(cause, 0, 'Unable to reach the backend.') };
  }
}

export function toSlice<T>(outcome: Outcome<T>, previous?: T): Slice<T> {
  return outcome.ok
    ? { status: 'ready', data: outcome.data }
    : { status: 'error', data: previous, message: outcome.problem.message, code: outcome.problem.code };
}

/** Headers for a protected POST: the session's CSRF token. The browser adds the Origin header itself. */
export async function writeHeaders(): Promise<Record<string, string>> {
  return csrfHeaders();
}
