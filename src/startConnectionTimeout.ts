import { ErrorCode } from './enums';
import PenpalError from './PenpalError';

/**
 * Starts a timeout and calls the callback with an error
 * if the timeout completes before the stop function is called.
 */
export default (
  timeout: number | undefined,
  callback: (error: PenpalError) => void
) => {
  let timeoutId: number;

  if (timeout !== undefined) {
    timeoutId = self.setTimeout(() => {
      callback(
        new PenpalError(
          ErrorCode.ConnectionTimeout,
          `Connection timed out after ${timeout}ms`
        )
      );
    }, timeout);
  }

  const stop = () => {
    clearTimeout(timeoutId);
  };

  return stop;
};
