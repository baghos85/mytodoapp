/**
 * Connectivity state (SPEC 7.5): offline when `navigator.onLine` is false, or after a request failed with
 * a network error, until the next request gets any HTTP response or the browser fires `online`.
 * Read it in components with `useOnlineStatus()`.
 */
type Listener = () => void;

const listeners = new Set<Listener>();
let networkFailed = false;

function emit(): void {
  for (const listener of listeners) listener();
}

function setNetworkFailed(value: boolean): void {
  if (networkFailed === value) return;
  networkFailed = value;
  emit();
}

function handleBrowserChange(): void {
  // A fresh `online` event means the browser got a connection back: give requests a new chance.
  networkFailed = false;
  emit();
}

export function isOnline(): boolean {
  return navigator.onLine && !networkFailed;
}

export function subscribeToConnectivity(listener: Listener): () => void {
  if (listeners.size === 0) {
    window.addEventListener('online', handleBrowserChange);
    window.addEventListener('offline', handleBrowserChange);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('online', handleBrowserChange);
      window.removeEventListener('offline', handleBrowserChange);
    }
  };
}

/** Called by `apiFetch` when a request failed without an HTTP response. */
export function reportNetworkFailure(): void {
  setNetworkFailed(true);
}

/** Called by `apiFetch` whenever a request got an HTTP response (any status). */
export function reportNetworkSuccess(): void {
  setNetworkFailed(false);
}
