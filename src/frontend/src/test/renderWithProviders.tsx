import { QueryClient } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '../app/providers';
import { appRoutes } from '../app/router';

/** No retries and no background refetches, so tests see exactly one request per query. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial URL for the `MemoryRouter`. */
  route?: string;
  queryClient?: QueryClient;
}

/** Renders a component with the app providers (TanStack Query, toasts) inside a `MemoryRouter`. */
export function renderWithProviders(
  ui: ReactElement,
  {
    route = '/',
    queryClient = createTestQueryClient(),
    ...options
  }: RenderWithProvidersOptions = {},
) {
  const user = userEvent.setup();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders queryClient={queryClient}>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </AppProviders>
  );
  return { user, queryClient, ...render(ui, { wrapper, ...options }) };
}

/** Renders the real route table at `path` (lazy pages, layouts, redirects). */
export function renderRoute(path: string, queryClient: QueryClient = createTestQueryClient()) {
  const user = userEvent.setup();
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  const result = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { user, router, queryClient, ...result };
}
