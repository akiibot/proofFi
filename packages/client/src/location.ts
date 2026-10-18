export function routeQuery(): URLSearchParams {
  const source = window.location.protocol === 'chrome-extension:' ? window.location.hash.split('?').slice(1).join('?') : window.location.search;
  return new URLSearchParams(source);
}
