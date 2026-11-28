import { QueryClient } from '@tanstack/react-query';
import { isRetryableError } from '../shared/api/errors';

/** QueryClient with the defaults from SPEC 10.8. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        // Offline requests still go out, so the service worker can answer from the `api-v1` cache.
        networkMode: 'offlineFirst',
        // One retry, only for no response / timeout / 503 (cold start). Never for 4xx.
        retry: (failureCount, error) => failureCount < 1 && isRetryableError(error),
      },
      mutations: {
        // Never paused or queued while offline (SPEC 7.5, ADR-016): an offline mutation fails fast with
        // NetworkError (which also switches the UI to offline mode) instead of replaying later.
        networkMode: 'always',
        retry: false,
      },
    },
  });
}
