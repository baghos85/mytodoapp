import { useEffect } from 'react';
import { useToast } from '../ui/useToast';
import { useServiceWorkerUpdate } from './useServiceWorkerUpdate';

export const UPDATE_MESSAGE = 'A new version is available.';

/** Shows "A new version is available." with a Reload button when a new service worker waits (SPEC 6.5). */
export function UpdatePrompt() {
  const { needRefresh, update } = useServiceWorkerUpdate();
  const { showToast, dismissToast } = useToast();

  useEffect(() => {
    if (!needRefresh) return;
    const id = showToast({
      message: UPDATE_MESSAGE,
      action: { label: 'Reload', onAction: () => void update() },
      durationMs: null,
    });
    return () => dismissToast(id);
  }, [needRefresh, update, showToast, dismissToast]);

  return null;
}
