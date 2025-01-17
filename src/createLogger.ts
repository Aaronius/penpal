import { Log } from './types';

export default (prefix: 'Parent' | 'Child', debug: boolean) => {
  const log: Log = (...args: unknown[]) => {
    if (debug) {
      console.log(`[Penpal] ${prefix}:`, ...args);
    }
  };

  return log;
};
