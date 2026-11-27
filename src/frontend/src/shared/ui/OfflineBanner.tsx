import { useOnlineStatus } from '../hooks/useOnlineStatus';
import styles from './OfflineBanner.module.css';

export const OFFLINE_MESSAGE = "You're offline. Showing saved data; changes are disabled.";

/** Persistent banner while offline (SPEC 6.5). The live region is always present so the change is announced. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  return (
    <div role="status" className={online ? undefined : styles.banner}>
      {online ? null : OFFLINE_MESSAGE}
    </div>
  );
}
