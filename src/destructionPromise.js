/**
 * A simplified promise class only used internally for when destroy() is called. This is
 * used to destroy connections synchronously while promises typically resolve asynchronously.
 *
 * @param {Function} executor
 * @returns {Object}
 * @constructor
 */
export default executor => {
  const handlers = [];

  executor(() => {
    handlers.forEach(handler => {
      handler();
    });
  });

  return {
    then(handler) {
      handlers.push(handler);
    }
  };
};
