import { useState } from 'react';
import { Outlet } from 'react-router';
import { Dialog } from '../../shared/ui/Dialog';
import { useRouteTitle } from '../routeHandle';
import styles from './AppShell.module.css';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useBreakpoint } from './useBreakpoint';

/**
 * Layout of the signed-in area (SPEC 6.2):
 * - desktop (≥ 1024 px): persistent sidebar;
 * - tablet (640–1023 px): top bar with a menu button that opens the sidebar as a drawer;
 * - mobile (< 640 px): top bar + bottom navigation.
 */
export function AppShell() {
  const breakpoint = useBreakpoint();
  const title = useRouteTitle();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className={`${styles.shell} ${styles[breakpoint] ?? ''}`}>
      {breakpoint === 'desktop' ? (
        <aside className={styles.sidebar}>
          <Sidebar />
        </aside>
      ) : (
        <TopBar
          title={title}
          menuOpen={drawerOpen}
          onMenuClick={breakpoint === 'tablet' ? () => setDrawerOpen(true) : undefined}
        />
      )}
      {breakpoint === 'tablet' && (
        <Dialog variant="drawer" title="Menu" open={drawerOpen} onClose={closeDrawer}>
          <Sidebar onNavigate={closeDrawer} />
        </Dialog>
      )}
      <main id="main-content" tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
      {breakpoint === 'mobile' && <BottomNav />}
    </div>
  );
}
