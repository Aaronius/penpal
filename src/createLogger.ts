export default (debug: boolean) => {
  return (...args: any) => {
    if (debug) {
      console.log('[Penpal]', ...args); // eslint-disable-line no-console
    }
  };
};
