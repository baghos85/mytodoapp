import { describe, expect, it } from 'vitest';
import { ApiError, isRetryableError, NetworkError, toProblemDetails } from './errors';

describe('isRetryableError', () => {
  it.each([
    ['network error', new NetworkError('network'), true],
    ['timeout', new NetworkError('timeout'), true],
    ['503', new ApiError(503), true],
    ['500', new ApiError(500), false],
    ['401', new ApiError(401), false],
    ['404', new ApiError(404), false],
    ['other error', new Error('boom'), false],
  ])('isRetryableError_%s_Returns%s', (_name, error, expected) => {
    expect(isRetryableError(error)).toBe(expected);
  });
});

describe('toProblemDetails', () => {
  it('toProblemDetails_UnexpectedShapes_KeepsOnlyWellTypedFields', () => {
    expect(
      toProblemDetails({
        title: 42,
        detail: 'x',
        errors: { a: ['ok', 1], b: 'no' },
        traceId: null,
      }),
    ).toEqual({
      type: undefined,
      title: undefined,
      status: undefined,
      detail: 'x',
      errors: { a: ['ok'] },
      traceId: undefined,
    });
  });

  it('toProblemDetails_NotAnObject_ReturnsEmpty', () => {
    expect(toProblemDetails('oops')).toEqual({});
  });
});
