const STORAGE_KEY = 'portfolio:stale-chunk-reload';
const RELOAD_COOLDOWN_MS = 10_000;

function reloadOnce(): boolean {
  const lastReload = Number(sessionStorage.getItem(STORAGE_KEY) ?? '0');
  const now = Date.now();

  if (now - lastReload < RELOAD_COOLDOWN_MS) {
    return false;
  }

  sessionStorage.setItem(STORAGE_KEY, String(now));
  window.location.reload();
  return true;
}

function isStaleChunkError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String(error ?? '');

  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('Loading chunk') ||
    message.includes('ChunkLoadError')
  );
}

/**
 * After a deploy, hashed lazy chunks disappear while a tab/PWA may still
 * reference the previous build. Reload once so the shell picks up new assets.
 */
export function setupStaleChunkReload() {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadOnce();
  });

  // iOS / React.lazy often surfaces these as promise rejections instead.
  window.addEventListener('unhandledrejection', (event) => {
    if (!isStaleChunkError(event.reason)) return;
    event.preventDefault();
    reloadOnce();
  });

  window.addEventListener('error', (event) => {
    if (!isStaleChunkError(event.error) && !isStaleChunkError(event.message)) return;
    reloadOnce();
  });
}

/**
 * iOS home-screen PWAs often resume from a frozen JS context after a deploy.
 * Check for a new build (and SW update) as soon as the app is foregrounded,
 * before a stale lazy import can blank the page.
 */
export function setupResumeDeployCheck(
  getRegistration: () => ServiceWorkerRegistration | undefined,
) {
  const checkForNewDeploy = async () => {
    if (document.visibilityState !== 'visible') return;

    const registration = getRegistration();
    if (registration) {
      try {
        await registration.update();
      } catch {
        // Ignore SW update failures (offline, etc.).
      }
    }

    try {
      const response = await fetch(`/build-id.txt?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!response.ok) return;

      const remoteBuildId = (await response.text()).trim();
      if (remoteBuildId && remoteBuildId !== __APP_BUILD_ID__) {
        reloadOnce();
      }
    } catch {
      // Ignore network failures while offline.
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void checkForNewDeploy();
    }
  });

  window.addEventListener('pageshow', () => {
    void checkForNewDeploy();
  });

  window.addEventListener('focus', () => {
    void checkForNewDeploy();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      reloadOnce();
    });
  }
}
