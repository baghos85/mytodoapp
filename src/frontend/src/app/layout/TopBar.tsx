import { Icon } from './Icon';
import styles from './TopBar.module.css';

interface TopBarProps {
  title?: string;
  /** Tablet only: opens the navigation drawer. */
  onMenuClick?: () => void;
  menuOpen?: boolean;
}

/**
 * Top app bar for mobile and tablet (SPEC 6.2). The page itself has the `<h1>`; the title here is plain
 * text. The account menu is added by the auth issue.
 */
export function TopBar({ title, onMenuClick, menuOpen = false }: TopBarProps) {
  return (
    <header className={styles.topBar}>
      {onMenuClick && (
        <button
          type="button"
          className={styles.menuButton}
          aria-label="Open navigation"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={onMenuClick}
        >
          <Icon name="menu" />
        </button>
      )}
      <p className={styles.title}>{title ?? 'MyTodoApp'}</p>
    </header>
  );
}
