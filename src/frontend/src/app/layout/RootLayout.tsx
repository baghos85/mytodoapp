import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router';
import { OfflineBanner } from '../../shared/ui/OfflineBanner';
import { useRouteTitle } from '../routeHandle';

const APP_NAME = 'MyTodoApp';

/**
 * Moves focus to the new page after a client-side navigation (SPEC 7.3, WCAG 2.4.3), so keyboard and
 * screen reader users start at the page heading instead of on the clicked link or `<body>`.
 * Prefers the page `<h1>`; falls back to `#main-content`.
 */
function focusPage(): void {
  const main = document.getElementById('main-content');
  const heading = main?.querySelector<HTMLElement>('h1');
  if (heading) {
    // Programmatic focus target only; not in the tab order.
    if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
    heading.focus();
  } else {
    main?.focus();
  }
}

/** Wraps every page: skip link, offline banner, `document.title` and focus on route change. */
export function RootLayout() {
  const title = useRouteTitle();
  const { pathname } = useLocation();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);

  useEffect(() => {
    // Not on the first load: the browser starts at the top of the document, as for any page.
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    focusPage();
  }, [pathname]);

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
