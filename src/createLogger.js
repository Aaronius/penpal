export default debug => {
  return (...args) => {
    if (debug) {
      console.log('[Penpal]', ...args); // eslint-disable-line no-console
    }
  };
};
