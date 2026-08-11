const STORAGE_KEY = 'portfolio:stale-chunk-reload';
const RELOAD_COOLDOWN_MS = 10_000;

/**
 * After a deploy, hashed lazy chunks disappear while a tab may still reference
 * the previous build. Vite emits `vite:preloadError` for that case — reload once
 * so the browser picks up the new index.html + assets.
 */
export function setupStaleChunkReload() {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();

    const lastReload = Number(sessionStorage.getItem(STORAGE_KEY) ?? '0');
    const now = Date.now();

    if (now - lastReload < RELOAD_COOLDOWN_MS) {
      return;
    }

    sessionStorage.setItem(STORAGE_KEY, String(now));
    window.location.reload();
  });
}
