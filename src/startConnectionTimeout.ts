import { PenpalError } from './types';
import { ErrorCode } from './enums';

/**
 * Starts a timeout and calls the callback with an error
 * if the timeout completes before the stop function is called.
 */
export default (timeout: number | undefined, callback: Function): Function => {
  let timeoutId: number;

  if (timeout !== undefined) {
    timeoutId = window.setTimeout(() => {
      const error: PenpalError = new Error(
        `Connection timed out after ${timeout}ms`
      ) as PenpalError;
      error.code = ErrorCode.ConnectionTimeout;
      callback(error);
    }, timeout);
  }

  return () => {
    clearTimeout(timeoutId);
  };
};
