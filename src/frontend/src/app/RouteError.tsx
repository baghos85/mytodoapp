import { Link } from 'react-router';
import { Button } from '../shared/ui/Button';
import styles from './layout/PublicLayout.module.css';

/** Last-resort error page (e.g. a page chunk failed to load). Never shows error details. */
export function RouteError() {
  return (
    <main id="main-content" className={styles.main}>
      <h1>Something went wrong</h1>
      <p>Please reload the page. If the problem continues, try again later.</p>
      <p>
        <Button onClick={() => window.location.reload()}>Reload</Button>{' '}
        <Link to="/today">Go to Today</Link>
      </p>
    </main>
  );
}
