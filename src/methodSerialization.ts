import { MethodPath, MethodProxy, Methods } from './types';

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
    } else if (typeof value === 'object' && value !== null) {
      methodPaths.push(
        ...extractMethodPathsFromMethods(value, [...currentPath, key])
      );
    }
  }

  return methodPaths;
};

/**
 * Given method paths (arrays of path segments), generates an object that
 * follows the method path structures and creates proxy methods at each method
 * path.
 *
 * @example
 * Given this MethodPath[]
 * [
 *   ['one', 'two'],
 *   ['three']
 * ]
 *
 * the extracted Methods would be:
 * {
 *   one: {
 *     two: <proxy method>
 *   }
 *   three: <proxy method>
 * }
 */
export const buildProxyMethodsFromMethodPaths = (
  methodPaths: MethodPath[],
  createMethodProxy: (methodPath: MethodPath) => MethodProxy
) => {
  const result: Methods = {};

  for (const methodPath of methodPaths) {
    const finalPathSegmentIndex = methodPath.length - 1;
    let currentLevel = result;

    for (const [index, pathSegment] of methodPath.entries()) {
      if (index === finalPathSegmentIndex) {
        currentLevel[pathSegment] = createMethodProxy(methodPath);
      } else {
        if (!currentLevel[pathSegment]) {
          currentLevel[pathSegment] = {};
        }
        currentLevel = currentLevel[pathSegment] as Methods;
      }
    }
  }

  return result;
};

export const getMethodAtMethodPath = (
  methodPath: MethodPath,
  methods: Methods
) => {
  const result = methodPath.reduce<Methods | Function | undefined>(
    (acc, pathSegment) => {
      return typeof acc === 'object' &&
        acc !== null &&
        // Avoid grabbing built-in properties on the Object prototype.
        Object.prototype.hasOwnProperty.call(acc, pathSegment)
        ? acc[pathSegment]
        : undefined;
    },
    methods
  );

  return typeof result === 'function' ? result : undefined;
};

export const formatMethodPath = (methodPath: MethodPath) => {
  return methodPath.join('.');
};
