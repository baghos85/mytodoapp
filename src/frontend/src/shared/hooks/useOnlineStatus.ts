import { useSyncExternalStore } from 'react';
import { isOnline, subscribeToConnectivity } from '../lib/connectivity';

/**
 * `true` while the app can reach the network (SPEC 7.5). Use it to disable mutating controls and to show
 * the `OfflineBanner`.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeToConnectivity, isOnline);
}
