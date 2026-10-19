// Vallet canonical JSON v1 (docs/DECISIONS.md D10): recursively sorted keys, compact separators, UTF-8, no floats; SHA-256.
// Mirrors services/api/app/core/canonical.py so the browser can name the exact digest of what the person reviewed.

type Canonical = null | string | number | boolean | Canonical[] | { [key: string]: Canonical };

function check(value: unknown): Canonical {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new TypeError('Canonical payloads accept integers only');
    return value;
  }
  if (Array.isArray(value)) return value.map(check);
  if (typeof value === 'object') {
    const out: { [key: string]: Canonical } = {};
    for (const key of Object.keys(value as object).sort()) out[key] = check((value as Record<string, unknown>)[key]);
    return out;
  }
  throw new TypeError('Canonical payloads accept only strings, integers, booleans, null, lists and objects');
}

/** Python's json.dumps(sort_keys=True, separators=(",", ":"), ensure_ascii=False). Sorting uses code-unit order, as Python does for these ASCII keys. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(check(value));
}

export async function canonicalDigest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}
