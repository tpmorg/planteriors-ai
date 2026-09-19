import { isLikelyNetworkError } from '../utils/networkErrorUtils';

export type AiErrorKind =
  | 'allowance'
  | 'rate_limit'
  | 'timeout'
  | 'unauthorized'
  | 'network'
  | 'server'
  | 'unknown';

export interface AiErrorPresentation {
  kind: AiErrorKind;
  /** Short, direct headline. Never "Oops". */
  title: string;
  /** Body copy for the user. */
  message: string;
  /** Label for the retry affordance, or null when retrying won't help. */
  retryLabel: string | null;
  /** Whether an automatic retry could succeed. */
  retryable: boolean;
  /** API request id, safe to quote to support. */
  reference?: string;
}

/**
 * The API contract returns `429` for *both* exhausted allowance and plain rate
 * limiting (see docs/server-side-api-plan.md), so the status code alone is
 * ambiguous. Classification therefore keys off `code` first and only falls back
 * to status, which is why `429 + allowance_exhausted` routes to the paywall
 * while `429 + anything else` is treated as throttling.
 */
const ALLOWANCE_CODES = new Set([
  'allowance_exhausted',
  'insufficient_credits',
  'payment_required',
  'entitlement_required',
  'no_entitlement',
]);

const RATE_LIMIT_CODES = new Set([
  'rate_limited',
  'rate_limit_exceeded',
  'too_many_requests',
  'throttled',
  'quota_exceeded',
  'resource_exhausted',
]);

type ApiErrorLike = {
  code?: unknown;
  status?: unknown;
  requestId?: unknown;
  retryable?: unknown;
  message?: unknown;
};

const asErrorLike = (error: unknown): ApiErrorLike =>
  typeof error === 'object' && error !== null ? (error as ApiErrorLike) : {};

const readCode = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const readStatus = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const readReference = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const readMessage = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

export function describeAiError(error: unknown): AiErrorPresentation {
  const api = asErrorLike(error);
  const code = readCode(api.code);
  const status = readStatus(api.status);
  const reference = readReference(api.requestId);
  const serverMessage = readMessage(api.message);
  const retryableFlag = typeof api.retryable === 'boolean' ? api.retryable : undefined;

  // 1. Out of credits. Checked before status so an allowance 429 is not
  //    mistaken for throttling.
  if (ALLOWANCE_CODES.has(code) || status === 402 || status === 403) {
    return {
      kind: 'allowance',
      title: "You've used all your design credits",
      message: 'Choose a plan to keep creating designs. Your saved designs are still here.',
      retryLabel: null,
      retryable: false,
      reference,
    };
  }

  // 2. Throttled. Retryable unless the server explicitly said otherwise.
  if (RATE_LIMIT_CODES.has(code) || status === 429) {
    return {
      kind: 'rate_limit',
      title: 'Too many requests',
      message: 'The AI service is busy right now. Wait a few seconds, then try again.',
      retryLabel: 'Try again',
      retryable: retryableFlag ?? true,
      reference,
    };
  }

  // 3. The request was interrupted, so the job outcome is unknown.
  if (code === 'timeout' || status === 408) {
    return {
      kind: 'timeout',
      title: "The request didn't finish",
      message: 'Its outcome is unknown, so check before submitting another one.',
      retryLabel: null,
      retryable: true,
      reference,
    };
  }

  // 4. Session problem.
  if (code === 'unauthorized' || status === 401) {
    return {
      kind: 'unauthorized',
      title: 'Please sign in again',
      message: 'Your session has expired. Sign in and try again.',
      retryLabel: null,
      retryable: false,
      reference,
    };
  }

  // 5. Service-side failure.
  if (status >= 500) {
    return {
      kind: 'server',
      title: 'The AI service is unavailable',
      message: 'Something went wrong on our side. Try again in a moment.',
      retryLabel: 'Try again',
      retryable: retryableFlag ?? true,
      reference,
    };
  }

  // 6. Connectivity - never reached the API.
  if (status === 0 && isLikelyNetworkError(error)) {
    return {
      kind: 'network',
      title: 'Connection failed',
      message: 'Check your internet connection and try again.',
      retryLabel: 'Try again',
      retryable: true,
      reference,
    };
  }

  return {
    kind: 'unknown',
    title: 'Generation failed',
    message: serverMessage ?? 'Something went wrong while generating your design.',
    retryLabel: 'Try again',
    retryable: retryableFlag ?? false,
    reference,
  };
}

/** True when the user genuinely has no allowance left and should see the paywall. */
export const isAllowanceError = (error: unknown): boolean =>
  describeAiError(error).kind === 'allowance';
