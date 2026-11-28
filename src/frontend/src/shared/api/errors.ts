/** RFC 9457 ProblemDetails as returned by the API (SPEC 4.1). */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  /** Validation errors keyed by camelCase field name (or Identity error code for register). */
  errors?: Record<string, string[]>;
  traceId?: string;
}

/** The API answered with a non-2xx status. */
export class ApiError extends Error {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly errors?: Record<string, string[]>;
  readonly traceId?: string;

  constructor(status: number, problem: ProblemDetails = {}) {
    const title = problem.title ?? `Request failed with status ${status}`;
    super(problem.detail ?? title);
    this.name = 'ApiError';
    this.status = status;
    this.title = title;
    this.detail = problem.detail;
    this.errors = problem.errors;
    this.traceId = problem.traceId;
  }
}

/**
 * The request never got an HTTP response: `network` = fetch failed (offline, DNS, connection reset),
 * `timeout` = no response within the client timeout (e.g. a very slow cold start).
 */
export class NetworkError extends Error {
  readonly kind: 'network' | 'timeout';

  constructor(kind: 'network' | 'timeout', options?: { cause?: unknown }) {
    super(
      kind === 'timeout' ? 'The server took too long to respond.' : "Couldn't reach the server.",
      options,
    );
    this.name = 'NetworkError';
    this.kind = kind;
  }
}

/**
 * The API answered 2xx, but the body is not the JSON we expect (e.g. a wrong `VITE_API_BASE_URL` that hits
 * the SPA fallback `index.html`). A configuration or deployment bug, not worth a retry.
 */
export class UnexpectedResponseError extends Error {
  readonly status: number;
  readonly contentType: string | null;

  constructor(status: number, contentType: string | null, options?: { cause?: unknown }) {
    super('The server sent an unexpected response.', options);
    this.name = 'UnexpectedResponseError';
    this.status = status;
    this.contentType = contentType;
  }
}

/** Worth one retry (SPEC 7.4, 10.8): no response, a timeout, or 503. Never 4xx. */
export function isRetryableError(error: unknown): boolean {
  return error instanceof NetworkError || (error instanceof ApiError && error.status === 503);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toErrors(value: unknown): Record<string, string[]> | undefined {
  if (!isRecord(value)) return undefined;
  const errors: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(value)) {
    if (Array.isArray(messages)) {
      errors[field] = messages.filter((m): m is string => typeof m === 'string');
    }
  }
  return errors;
}

/** Reads the known ProblemDetails fields from an untrusted JSON value. */
export function toProblemDetails(value: unknown): ProblemDetails {
  if (!isRecord(value)) return {};
  const str = (key: string) => (typeof value[key] === 'string' ? value[key] : undefined);
  return {
    type: str('type'),
    title: str('title'),
    status: typeof value.status === 'number' ? value.status : undefined,
    detail: str('detail'),
    errors: toErrors(value.errors),
    traceId: str('traceId'),
  };
}
