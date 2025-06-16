export const DEBUG = (() => {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1') return true;
    if (window.localStorage.getItem('DEBUG') === '1') return true;
  } catch {
    // ignore
  }
  return false;
})();

export function debugLog(...args) {
  if (DEBUG) console.log(...args);
}
