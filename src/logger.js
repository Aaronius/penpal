let debugEnabled = false;

/**
 * Whether debug messages should be logged.
 * @type {boolean}
 */
export const setDebugEnabled = value => {
  debugEnabled = value;
};

export const getDebugEnabled = () => {
  return debugEnabled;
};

export const log = (...args) => {
  if (debugEnabled) {
    console.log('[Penpal]', ...args); // eslint-disable-line no-console
  }
};
