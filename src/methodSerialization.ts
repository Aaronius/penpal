import { MethodPath, Methods } from './types';
import { isObject } from './guards';

// TODO: Used for backward-compatibility. Remove in next major version.
/**
 * Given an object of (nested) keys to functions, extract paths to each function.
 *
 * @example
 * Given this Method object:
 * {
 *   one: {
 *     two: () => {}
 *   }
 *   three: () => {}
 * }
 *
 * the extracted MethodPath[] would be:
 * [
 *   ['one', 'two'],
 *   ['three']
 * ]
 */
export const extractMethodPathsFromMethods = (
  methods: Methods,
  currentPath: MethodPath = []
) => {
  const methodPaths: MethodPath[] = [];

  for (const key of Object.keys(methods)) {
    const value = methods[key];

    if (typeof value === 'function') {
      methodPaths.push([...currentPath, key]);
    } else if (isObject(value)) {
      methodPaths.push(
        ...extractMethodPathsFromMethods(value, [...currentPath, key])
      );
    }
  }

  return methodPaths;
};

export const getMethodAtMethodPath = (
  methodPath: MethodPath,
  methods: Methods
) => {
  const result = methodPath.reduce<Methods | Function | undefined>(
    (acc, pathSegment) => {
      return isObject(acc) ? acc[pathSegment] : undefined;
    },
    methods
  );

  return typeof result === 'function' ? result : undefined;
};

export const formatMethodPath = (methodPath: MethodPath) => {
  return methodPath.join('.');
};
