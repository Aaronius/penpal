export default (debug: boolean) => {
  /**
   * Logs a message if debug is enabled.
   */
  return (...args: any) => {
    if (debug) {
      console.log('[Penpal]', ...args); // eslint-disable-line no-console
    }
  };
};
