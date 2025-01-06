import { FlattenedMethods, Methods } from './types';

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
 * @example
 * If a Methods object were like this:
 * { one: { two: () => {} } }
 *
 * it would flatten to this:
 * { "one.two": () => {} }
 *
 * @param methods The (potentially nested) object to serialize.
 * @param prefix A string with which to prefix entries. Typically not intended to be used by consumers.
 * @returns An map from key path in `methods` to functions.
 */
export const flattenMethods = (
  methods: Methods,
  prefix = ''
): FlattenedMethods =>
  Object.entries(methods).reduce<FlattenedMethods>((result, [key, value]) => {
    const keyPath = createKeyPath(key, prefix);

    if (typeof value === 'function') {
      result[keyPath] = value;
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenMethods(value as Methods, keyPath));
    }

    return result;
  }, {});

/**
 * Given a map of key paths to functions, unpack the key paths to an object.
 *
 * @example
 * If a FlattenedMethods object were like this:
 * { "one.two": () => {} }
 *
 * it would unflatten to this:
 * { one: { two: () => {} } }
 *
 * @param flattenedMethods A map of key paths to functions to unpack.
 * @returns A (potentially nested) map of functions.
 */
export const unflattenMethods = (flattenedMethods: FlattenedMethods): Methods =>
  Object.entries(flattenedMethods).reduce<Methods>(
    (result, [methodPath, value]) => {
      setAtKeyPath(result, methodPath, value);
      return result;
    },
    {}
  );
