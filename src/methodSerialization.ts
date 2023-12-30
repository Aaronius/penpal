import { SerializedMethods, Methods } from './types';

const KEY_PATH_DELIMITER = '.';

const keyPathToSegments = (keyPath: string) =>
  keyPath ? keyPath.split(KEY_PATH_DELIMITER) : [];
const segmentsToKeyPath = (segments: string[]) =>
  segments.join(KEY_PATH_DELIMITER);

const createKeyPath = (key: string, prefix?: string) => {
  const segments = keyPathToSegments(prefix || '');
  segments.push(key);
  return segmentsToKeyPath(segments);
};

/**
 * Given a `keyPath`, set it to be `value` on `subject`, creating any intermediate
 * objects along the way.
 *
 * @param {Object} subject The object on which to set value.
 * @param {string} keyPath The key path at which to set value.
 * @param {Object} value The value to store at the given key path.
 * @returns {Object} Updated subject.
 */
export const setAtKeyPath = (
  subject: Record<string, any>,
  keyPath: string,
  value: unknown
) => {
  const segments = keyPathToSegments(keyPath);

  segments.reduce((prevSubject, key, idx) => {
    if (typeof prevSubject[key] === 'undefined') {
      prevSubject[key] = {};
    }

    if (idx === segments.length - 1) {
      prevSubject[key] = value;
    }

    return prevSubject[key];
  }, subject);

  return subject;
};

/**
 * Given a dictionary of (nested) keys to function, flatten them to a map
 * from key path to function.
 *
 * @param {Object} methods The (potentially nested) object to serialize.
 * @param {string} prefix A string with which to prefix entries. Typically not intended to be used by consumers.
 * @returns {Object} An map from key path in `methods` to functions.
 */
export const serializeMethods = (
  methods: Methods,
  prefix?: string
): SerializedMethods => {
  const flattenedMethods: SerializedMethods = {};

  Object.keys(methods).forEach((key) => {
    const value = methods[key];
    const keyPath = createKeyPath(key, prefix);

    if (typeof value === 'object') {
      // Recurse into any nested children.
      Object.assign(flattenedMethods, serializeMethods(value, keyPath));
    }

    if (typeof value === 'function') {
      // If we've found a method, expose it.
      flattenedMethods[keyPath] = value;
    }
  });

  return flattenedMethods;
};

/**
 * Given a map of key paths to functions, unpack the key paths to an object.
 *
 * @param {Object} flattenedMethods A map of key paths to functions to unpack.
 * @returns {Object} A (potentially nested) map of functions.
 */
export const deserializeMethods = (
  flattenedMethods: SerializedMethods
): Methods => {
  const methods: Methods = {};

  for (const keyPath in flattenedMethods) {
    setAtKeyPath(methods, keyPath, flattenedMethods[keyPath]);
  }

  return methods;
};
