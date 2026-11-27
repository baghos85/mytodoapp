import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { OfflineBanner } from '../../shared/ui/OfflineBanner';
import { useRouteTitle } from '../routeHandle';

const APP_NAME = 'MyTodoApp';

/** Wraps every page: skip link, offline banner, `document.title` from the route handle. */
export function RootLayout() {
  const title = useRouteTitle();

  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <OfflineBanner />
      <Outlet />
    </>
  );
}
