import { Link, NavLink } from 'react-router';
import { Icon } from './Icon';
import { navItems } from './navItems';
import styles from './Sidebar.module.css';

interface SidebarProps {
  /** Called after a link is followed (the tablet drawer closes itself). */
  onNavigate?: () => void;
}

/** Desktop sidebar, also the content of the tablet drawer (SPEC 6.2). */
export function Sidebar({ onNavigate }: SidebarProps) {
  return (
    <div className={styles.sidebar}>
      <p className={styles.brand}>MyTodoApp</p>
      <nav aria-label="Main" className={styles.nav}>
        <ul className={styles.list}>
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={onNavigate}
                className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
              >
                <Icon name={item.icon} />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <p className={styles.footer}>
        <Link to="/privacy" onClick={onNavigate} className={styles.footerLink}>
          Privacy
        </Link>
      </p>
    </div>
  );
}
