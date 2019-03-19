/**
 * Converts an error object into a plain object.
 * @param {Error} Error object.
 * @returns {Object}
 */
export const serializeError = ({ name, message, stack }) => ({
  name,
  message,
  stack
});

/**
 * Converts a plain object into an error object.
 * @param {Object} Object with error properties.
 * @returns {Error}
 */
export const deserializeError = obj => {
  const deserializedError = new Error();
  Object.keys(obj).forEach(key => (deserializedError[key] = obj[key]));
  return deserializedError;
};
