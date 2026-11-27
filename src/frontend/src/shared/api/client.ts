import { reportNetworkFailure, reportNetworkSuccess } from '../lib/connectivity';
import { ApiError, NetworkError, toProblemDetails } from './errors';

const DEFAULT_API_BASE_URL = '/api/v1';

/** 90 s: covers a cold start (container scale-from-zero + SQL serverless resume, SPEC 7.4). */
export const API_TIMEOUT_MS = 90_000;

/** Base URL from build-time config (SPEC 10.7), never hard-coded per call. No trailing slash. */
export function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, '');
}

export interface ApiRequestInit extends Omit<RequestInit, 'body'> {
  /** Serialised as JSON with `Content-Type: application/json`. */
  body?: unknown;
  /** Defaults to {@link API_TIMEOUT_MS}. */
  timeoutMs?: number;
}

function isJson(response: Response): boolean {
  const type = response.headers.get('Content-Type') ?? '';
  return type.includes('application/json') || type.includes('application/problem+json');
}

async function readProblem(response: Response): Promise<unknown> {
  if (!isJson(response)) return undefined;
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/**
 * Calls the API (SPEC 10.8). `path` is relative to the base URL, e.g. `/task-lists`.
 * - Resolves with the parsed JSON body, or `undefined` for `204` / an empty body.
 * - Rejects with `ApiError` for non-2xx responses (ProblemDetails fields copied over),
 *   `NetworkError` for no response or a timeout, and rethrows the caller's own abort unchanged
 *   (TanStack Query cancellation).
 */
export async function apiFetch<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const { body, timeoutMs = API_TIMEOUT_MS, headers: initHeaders, signal, ...rest } = init;

  const headers = new Headers(initHeaders);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (body !== undefined) headers.set('Content-Type', 'application/json');

  // Own controller (not AbortSignal.timeout) so the timeout can be told apart from a caller abort.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener('abort', abortFromCaller, { once: true });

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...rest,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) throw new NetworkError('timeout', { cause: error });
    if (signal?.aborted) throw error;
    reportNetworkFailure();
    throw new NetworkError('network', { cause: error });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortFromCaller);
  }

  reportNetworkSuccess();

  if (!response.ok) {
    throw new ApiError(response.status, toProblemDetails(await readProblem(response)));
  }
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
