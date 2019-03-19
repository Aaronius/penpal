let Promise;

try {
  Promise = window ? window.Promise : null;
} catch (e) {
  // ignore
}

/**
 * Promise implementation.
 * @type {Constructor}
 */
export const getPromise = () => Promise;
export const setPromise = value => (Promise = value);
