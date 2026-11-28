import { onlineManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError } from '../shared/api/errors';
import { createQueryClient } from './queryClient';

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('createQueryClient', () => {
  it('createQueryClient_Defaults_MatchSpec', () => {
    const { queries, mutations } = createQueryClient().getDefaultOptions();

    expect(queries).toMatchObject({
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst',
    });
    expect(mutations).toMatchObject({ networkMode: 'always', retry: false });
  });

  it('createQueryClient_MutationWhileOffline_RejectsInsteadOfPausing', async () => {
    onlineManager.setOnline(false);
    const client = createQueryClient();
    const mutationFn = vi.fn(() => Promise.reject(new NetworkError('network')));

    const outcome = client
      .getMutationCache()
      .build(client, { mutationFn })
      .execute(undefined)
      .catch((e: unknown) => e);

    await expect(outcome).resolves.toBeInstanceOf(NetworkError);
    expect(mutationFn).toHaveBeenCalledTimes(1);
    expect(client.getMutationCache().getAll()[0]?.state.isPaused).toBe(false);
  });

  it.each([
    ['NetworkError', new NetworkError('network'), true],
    ['503', new ApiError(503), true],
    ['400', new ApiError(400), false],
  ])('createQueryClient_QueryRetry_%s_RetriesOnlyWhenRetryable', (_name, error, expected) => {
    const { queries } = createQueryClient().getDefaultOptions();
    const retry = queries?.retry;
    if (typeof retry !== 'function') throw new Error('retry should be a function');

    expect(retry(0, error)).toBe(expected);
    expect(retry(1, error)).toBe(false);
  });
});
