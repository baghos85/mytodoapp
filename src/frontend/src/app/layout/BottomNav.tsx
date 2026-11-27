import { NavLink } from 'react-router';
import styles from './BottomNav.module.css';
import { Icon } from './Icon';
import { navItems } from './navItems';

/** Mobile bottom navigation (SPEC 6.2): icon + visible label, 44 px+ touch targets. */
export function BottomNav() {
  return (
    <nav aria-label="Main" className={styles.bottomNav}>
      <ul className={styles.list}>
        {navItems.map((item) => (
          <li key={item.to} className={styles.item}>
            <NavLink
              to={item.to}
              className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            >
              <Icon name={item.icon} />
              <span className={styles.label}>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
