import { Outlet } from 'react-router';
import styles from './PublicLayout.module.css';

/** Layout for pages without app navigation: sign in, register, privacy, not found. */
export function PublicLayout() {
  return (
    <main id="main-content" tabIndex={-1} className={styles.main}>
      <Outlet />
    </main>
  );
}
