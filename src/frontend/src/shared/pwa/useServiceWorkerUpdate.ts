import { useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export interface ServiceWorkerUpdate {
  /** A new version is installed and waiting (SPEC 6.5, `registerType: 'prompt'`). */
  needRefresh: boolean;
  /** Activates the waiting service worker; the page reloads once it takes control. Stable identity. */
  update: () => Promise<void>;
}

/**
 * Registers the service worker from app code (no inline script, CSP-safe) and reports waiting updates.
 * Mount it once (see `UpdatePrompt`).
 */
export function useServiceWorkerUpdate(): ServiceWorkerUpdate {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error: unknown) {
      console.error('Service worker registration failed', error);
    },
  });
  const update = useCallback(() => updateServiceWorker(true), [updateServiceWorker]);
  return { needRefresh, update };
}
