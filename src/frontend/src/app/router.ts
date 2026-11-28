import type { ComponentType } from 'react';
import { redirect, type RouteObject } from 'react-router';
import { AppShell } from './layout/AppShell';
import { PageFallback } from './layout/PageFallback';
import { PublicLayout } from './layout/PublicLayout';
import { RootLayout } from './layout/RootLayout';
import { RouteError } from './RouteError';
import type { RouteHandle } from './routeHandle';

/** Route-level code splitting: the page module loads on first visit (SPEC 7.4). */
function page<M>(load: () => Promise<M>, pick: (module: M) => ComponentType) {
  return async () => ({ Component: pick(await load()) });
}

function handle(title: string): RouteHandle {
  return { title };
}

/** All routes from SPEC 6.1. Auth guards (`RequireAuth`) are added by the auth issue. */
export const appRoutes: RouteObject[] = [
  {
    Component: RootLayout,
    HydrateFallback: PageFallback,
    ErrorBoundary: RouteError,
    children: [
      {
        // Signed-in area with navigation.
        Component: AppShell,
        children: [
          { index: true, loader: () => redirect('/today') },
          {
            path: 'today',
            handle: handle('Today'),
            lazy: page(
              () => import('../features/views/TodayPage'),
              (m) => m.TodayPage,
            ),
          },
          {
            path: 'upcoming',
            handle: handle('Upcoming'),
            lazy: page(
              () => import('../features/views/UpcomingPage'),
              (m) => m.UpcomingPage,
            ),
          },
          {
            path: 'completed',
            handle: handle('Completed'),
            lazy: page(
              () => import('../features/views/CompletedPage'),
              (m) => m.CompletedPage,
            ),
          },
          {
            path: 'lists',
            handle: handle('Lists'),
            lazy: page(
              () => import('../features/lists/ListsPage'),
              (m) => m.ListsPage,
            ),
          },
          {
            path: 'lists/:listId',
            handle: handle('List'),
            lazy: page(
              () => import('../features/lists/ListPage'),
              (m) => m.ListPage,
            ),
          },
          {
            path: 'account',
            handle: handle('Account'),
            lazy: page(
              () => import('../features/account/AccountPage'),
              (m) => m.AccountPage,
            ),
          },
        ],
      },
      {
        // Public pages without the app navigation.
        Component: PublicLayout,
        children: [
          {
            path: 'login',
            handle: handle('Sign in'),
            lazy: page(
              () => import('../features/auth/LoginPage'),
              (m) => m.LoginPage,
            ),
          },
          {
            path: 'register',
            handle: handle('Create account'),
            lazy: page(
              () => import('../features/auth/RegisterPage'),
              (m) => m.RegisterPage,
            ),
          },
          {
            path: 'privacy',
            handle: handle('Privacy'),
            lazy: page(
              () => import('../features/privacy/PrivacyPage'),
              (m) => m.PrivacyPage,
            ),
          },
          {
            path: '*',
            handle: handle('Page not found'),
            lazy: page(
              () => import('./NotFoundPage'),
              (m) => m.NotFoundPage,
            ),
          },
        ],
      },
    ],
  },
];
