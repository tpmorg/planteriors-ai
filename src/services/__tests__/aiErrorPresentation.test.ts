import { describeAiError, isAllowanceError } from '../aiErrorPresentation';

/**
 * Minimal stand-in for the service's AiApiError. The classifier is deliberately
 * structural (it never imports the service) so it can run without pulling in
 * expo/firebase modules.
 */
class ApiLikeError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly retryable?: boolean,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiLikeError';
  }
}

describe('describeAiError', () => {
  describe('the ambiguous 429', () => {
    it('treats 429 + allowance_exhausted as an allowance problem (paywall), not throttling', () => {
      const failure = describeAiError(
        new ApiLikeError('No allowance remaining', 'allowance_exhausted', 429),
      );

      expect(failure.kind).toBe('allowance');
      expect(failure.retryable).toBe(false);
      expect(failure.retryLabel).toBeNull();
    });

    it('treats a 429 with no usable code as throttling', () => {
      const failure = describeAiError(new ApiLikeError('Too many requests', 'request_failed', 429));

      expect(failure.kind).toBe('rate_limit');
      expect(failure.retryable).toBe(true);
      expect(failure.retryLabel).toBe('Try again');
    });

    it('treats upstream quota codes as throttling, not an allowance problem', () => {
      ['quota_exceeded', 'resource_exhausted', 'rate_limited', 'too_many_requests'].forEach((code) => {
        expect(describeAiError(new ApiLikeError('busy', code, 429)).kind).toBe('rate_limit');
      });
    });

    it('honours an explicit retryable:false on a 429', () => {
      const failure = describeAiError(new ApiLikeError('quota gone', 'quota_exceeded', 429, false));

      expect(failure.kind).toBe('rate_limit');
      expect(failure.retryable).toBe(false);
    });

    it('surfaces the request id as a support reference', () => {
      const failure = describeAiError(
        new ApiLikeError('busy', 'rate_limited', 429, true, 'req_abc123'),
      );

      expect(failure.reference).toBe('req_abc123');
    });
  });

  describe('allowance', () => {
    it('maps forbidden/403 to allowance so the paywall still shows', () => {
      expect(describeAiError(new ApiLikeError('forbidden', 'forbidden', 403)).kind).toBe('allowance');
      expect(describeAiError(new ApiLikeError('nope', 'request_failed', 402)).kind).toBe('allowance');
    });

    it('is exposed through isAllowanceError', () => {
      expect(isAllowanceError(new ApiLikeError('x', 'allowance_exhausted', 429))).toBe(true);
      expect(isAllowanceError(new ApiLikeError('x', 'rate_limited', 429))).toBe(false);
    });
  });

  describe('other failure modes', () => {
    it('classifies timeouts and keeps them retryable', () => {
      const failure = describeAiError(new ApiLikeError('too slow', 'timeout', 408, true));

      expect(failure.kind).toBe('timeout');
      expect(failure.retryable).toBe(true);
      expect(failure.retryLabel).toBeNull();
    });

    it('classifies 401s as a session problem', () => {
      expect(describeAiError(new ApiLikeError('nope', 'unauthorized', 401)).kind).toBe('unauthorized');
    });

    it('classifies 5xx as a server problem and retryable by default', () => {
      const failure = describeAiError(new ApiLikeError('boom', 'request_failed', 503));

      expect(failure.kind).toBe('server');
      expect(failure.retryable).toBe(true);
    });

    it('classifies a transport failure with no status as a network problem', () => {
      const failure = describeAiError(new TypeError('Network request failed'));

      expect(failure.kind).toBe('network');
      expect(failure.title).toBe('Connection failed');
    });

    it('falls back to the server message for unknown codes', () => {
      const failure = describeAiError(new ApiLikeError('Plant type is required.', 'invalid_input', 400));

      expect(failure.kind).toBe('unknown');
      expect(failure.message).toBe('Plant type is required.');
      expect(failure.retryable).toBe(false);
    });

    it('never falls back to an "Oops" headline', () => {
      const inputs: unknown[] = [
        new ApiLikeError('x', 'allowance_exhausted', 429),
        new ApiLikeError('x', 'rate_limited', 429),
        new ApiLikeError('x', 'timeout', 408),
        new ApiLikeError('x', 'unauthorized', 401),
        new ApiLikeError('x', 'request_failed', 500),
        new TypeError('Network request failed'),
        new ApiLikeError('x', 'invalid_input', 400),
        undefined,
        null,
        'a string',
        {},
      ];

      inputs.forEach((input) => {
        expect(describeAiError(input).title.toLowerCase()).not.toContain('oops');
      });
    });
  });

  describe('non-error inputs', () => {
    it.each([undefined, null, 'a string', 42, {}])('does not throw for %p', (input) => {
      const failure = describeAiError(input);

      expect(failure.kind).toBe('unknown');
      expect(failure.message.length).toBeGreaterThan(0);
    });
  });
});
