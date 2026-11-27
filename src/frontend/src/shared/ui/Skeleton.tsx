import styles from './Skeleton.module.css';

interface SkeletonProps {
  /** Number of placeholder rows. */
  rows?: number;
  /** Announced to screen readers while loading. */
  label?: string;
}

/** Placeholder rows shown while data loads (SPEC 6.5). Sized like real rows to avoid layout jumps. */
export function Skeleton({ rows = 3, label = 'Loading…' }: SkeletonProps) {
  return (
    <div role="status" className={styles.skeleton}>
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className={styles.row} aria-hidden="true" />
      ))}
    </div>
  );
}
