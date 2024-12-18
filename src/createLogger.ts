import { Log } from './types';

export default (debug: boolean) => {
  const log: Log = (...args: unknown[]) => {
    if (debug) {
      console.log('[Penpal]', ...args);
    }
  };

  return log;
};
