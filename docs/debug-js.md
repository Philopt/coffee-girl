# Debug Logging

The game includes a small `src/debug.js` helper that toggles verbose console output. It exports two pieces:

- `DEBUG` – `true` when logging is enabled.
- `debugLog()` – wrapper around `console.log` that only prints when `DEBUG` is set.

```js
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
```

## Enabling logging

Open the game with `?debug=1` appended to the URL or set `localStorage.DEBUG = '1'` in the browser console:

```
http://localhost:8080/?debug=1
```

Reload the page after setting `localStorage.DEBUG` for the flag to take effect. When either option is active the `DEBUG` constant is `true` and `debugLog()` prints to the console.

## Modules that log output

The following modules check `DEBUG` or call `debugLog()` to emit additional information:

- `src/main.js`
- `src/dialog.js`
- `src/intro.js`
- `src/entities/customerQueue.js`
- `src/assets.js`

Other modules may read the flag in the future, but these are the primary sources of debug output today.
