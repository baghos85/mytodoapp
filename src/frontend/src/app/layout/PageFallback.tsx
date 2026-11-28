import { Skeleton } from '../../shared/ui/Skeleton';
import styles from './PublicLayout.module.css';

/** Shown while the first page chunk loads. */
export function PageFallback() {
  return (
    <div className={styles.main}>
      <Skeleton rows={4} />
    </div>
  );
}
