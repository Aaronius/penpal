import PenpalError from './PenpalError.js';

const scheduleTimeout = (
  callback: () => void,
  timeout: number | undefined,
): (() => void) | undefined => {
  if (timeout === undefined) {
    return;
  }

  if (
    typeof globalThis.setTimeout !== 'function' ||
    typeof globalThis.clearTimeout !== 'function'
  ) {
    throw new PenpalError(
      'INVALID_ARGUMENT',
      'Timeouts are unavailable in this environment',
    );
  }

  const timeoutId = globalThis.setTimeout(callback, timeout);
  return () => globalThis.clearTimeout(timeoutId);
};

export default scheduleTimeout;
