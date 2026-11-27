import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { isOnline } from '../lib/connectivity';
import { apiFetch } from './client';
import { ApiError, NetworkError } from './errors';

type FetchMock = Mock<typeof fetch>;

let fetchMock: FetchMock;

function jsonResponse(body: unknown, status = 200, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } });
}

function lastRequest(): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error('fetch was not called');
  return { url: String(call[0]), init: call[1] ?? {} };
}

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('apiFetch', () => {
  it('apiFetch_NoBaseUrlConfigured_CallsDefaultBaseWithSameOriginCredentials', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    fetchMock.mockResolvedValue(jsonResponse({ id: '1', email: 'a@b.test' }));

    const result = await apiFetch<{ id: string; email: string }>('/auth/me');

    expect(result).toEqual({ id: '1', email: 'a@b.test' });
    const { url, init } = lastRequest();
    expect(url).toBe('/api/v1/auth/me');
    expect(init.credentials).toBe('same-origin');
    expect(new Headers(init.headers).get('Accept')).toBe('application/json');
  });

  it('apiFetch_BaseUrlConfigured_UsesConfiguredBase', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '/custom/api/');
    fetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    await apiFetch('/task-lists');

    expect(lastRequest().url).toBe('/custom/api/task-lists');
  });

  it('apiFetch_WithBody_SendsJsonWithContentType', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await apiFetch('/task-lists/1', { method: 'PUT', body: { name: 'Work' } });

    const { init } = lastRequest();
    expect(init.method).toBe('PUT');
    expect(init.body).toBe('{"name":"Work"}');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });

  it('apiFetch_WithoutBody_SendsNoContentType', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    await apiFetch('/task-lists');

    const { init } = lastRequest();
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).has('Content-Type')).toBe(false);
  });

  it('apiFetch_204NoContent_ReturnsUndefined', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiFetch('/tasks/1/complete', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('apiFetch_200WithEmptyBody_ReturnsUndefined', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 200 }));

    await expect(
      apiFetch('/auth/login?useCookies=true', { method: 'POST' }),
    ).resolves.toBeUndefined();
  });

  it('apiFetch_ProblemDetailsResponse_ThrowsApiErrorWithAllFields', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1',
          title: 'One or more validation errors occurred.',
          status: 400,
          detail: 'See errors.',
          errors: { title: ['The title must be between 1 and 200 characters.'] },
          traceId: '00-abc-def-01',
        },
        400,
        'application/problem+json',
      ),
    );

    const error = await apiFetch('/task-lists/1/tasks', { method: 'POST', body: {} }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      title: 'One or more validation errors occurred.',
      detail: 'See errors.',
      errors: { title: ['The title must be between 1 and 200 characters.'] },
      traceId: '00-abc-def-01',
    });
  });

  it('apiFetch_ErrorWithoutProblemBody_ThrowsApiErrorWithStatus', async () => {
    fetchMock.mockResolvedValue(new Response('Bad gateway', { status: 502 }));

    const error = await apiFetch('/task-lists').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, detail: undefined, errors: undefined });
  });

  it('apiFetch_FetchRejects_ThrowsNetworkErrorAndSwitchesToOffline', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await apiFetch('/task-lists').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NetworkError);
    expect(error).toMatchObject({ kind: 'network' });
    expect(isOnline()).toBe(false);
  });

  it('apiFetch_ResponseAfterNetworkFailure_SwitchesBackToOnline', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));

    await apiFetch('/task-lists').catch(() => undefined);
    await apiFetch('/task-lists');

    expect(isOnline()).toBe(true);
  });

  it('apiFetch_NoResponseWithin90Seconds_ThrowsTimeoutNetworkError', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          );
        }),
    );
    let settled = false;
    const request = apiFetch('/tasks/completed').finally(() => {
      settled = true;
    });
    const outcome = request.catch((e: unknown) => e);

    await vi.advanceTimersByTimeAsync(89_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    const error = await outcome;
    expect(error).toBeInstanceOf(NetworkError);
    expect(error).toMatchObject({ kind: 'timeout' });
    // A slow server is not "offline".
    expect(isOnline()).toBe(true);
  });

  it('apiFetch_CallerAborts_RethrowsAbortWithoutGoingOffline', async () => {
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted.', 'AbortError')),
          );
        }),
    );
    const controller = new AbortController();

    const outcome = apiFetch('/task-lists', { signal: controller.signal }).catch((e: unknown) => e);
    controller.abort();

    const error = await outcome;
    expect(error).not.toBeInstanceOf(NetworkError);
    expect(error).toMatchObject({ name: 'AbortError' });
    expect(isOnline()).toBe(true);
  });
});
