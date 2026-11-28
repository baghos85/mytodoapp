import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ToastProvider } from '../shared/ui/Toast';

interface AppProvidersProps {
  /** Created once with `createQueryClient()` (app) or `createTestQueryClient()` (tests). */
  queryClient: QueryClient;
  children: ReactNode;
}

/** App-wide providers (outside the router). */
export function AppProviders({ queryClient, children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
