import { SerializedMethods, Methods } from './types';

const KEY_PATH_DELIMITER = '.';

const keyPathToSegments = (keyPath: string): string[] =>
  keyPath.split(KEY_PATH_DELIMITER).filter(Boolean);

const createKeyPath = (key: string, prefix = ''): string =>
  prefix ? `${prefix}${KEY_PATH_DELIMITER}${key}` : key;

/**
 * Given a `keyPath`, set it to be `value` on `subject`, creating any intermediate
 * objects along the way.
 *
 * @param subject The object on which to set value.
 * @param keyPath The key path at which to set value.
 * @param value The value to store at the given key path.
 * @returns Updated subject.
 */
export const setAtKeyPath = <T extends Record<string, unknown>, V = unknown>(
  subject: T,
  keyPath: string,
  value: V
): T => {
  const segments = keyPathToSegments(keyPath);

  segments.reduce<Record<string, unknown>>((current, key, idx) => {
    if (idx === segments.length - 1) {
      current[key] = value;
    } else {
      current[key] = current[key] || {};
    }
    return current[key] as Record<string, unknown>;
  }, subject);

  return subject;
};

/**
 * Given a dictionary of (nested) keys to function, flatten them to a map
 * from key path to function.
 *
 * @param methods The (potentially nested) object to serialize.
 * @param prefix A string with which to prefix entries. Typically not intended to be used by consumers.
 * @returns An map from key path in `methods` to functions.
 */
export const serializeMethods = (
  methods: Methods,
  prefix = ''
): SerializedMethods =>
  Object.entries(methods).reduce<SerializedMethods>((result, [key, value]) => {
    const keyPath = createKeyPath(key, prefix);

    if (typeof value === 'function') {
      result[keyPath] = value;
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, serializeMethods(value as Methods, keyPath));
    }

    return result;
  }, {});

/**
 * Given a map of key paths to functions, unpack the key paths to an object.
 *
 * @param flattenedMethods A map of key paths to functions to unpack.
 * @returns A (potentially nested) map of functions.
 */
export const deserializeMethods = (
  flattenedMethods: SerializedMethods
): Methods =>
  Object.entries(flattenedMethods).reduce<Methods>(
    (result, [keyPath, value]) => {
      setAtKeyPath(result, keyPath, value);
      return result;
    },
    {}
  );
