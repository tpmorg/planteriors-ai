export const isLikelyNetworkError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }

  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: unknown }).message ?? '')
          : '';

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';

  const combined = `${code} ${message}`.toLowerCase();

  return [
    'network-request-failed',
    'network request failed',
    'no internet connection',
    'internet connection',
    'timeout',
    'timed out',
    'fetch failed',
    'failed to fetch',
    'socket',
    'econn',
    'etimedout',
    'offline',
    'apiconnectionerror',
  ].some((needle) => combined.includes(needle));
};
