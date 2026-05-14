import { MethodPath, Methods } from './types.js';
import { isFunction, isObject } from './guards.js';

export const getMethodAtMethodPath = (
  methodPath: MethodPath,
  methods: Methods
) => {
  const result = methodPath.reduce<Methods | Function | undefined>(
    (acc, pathSegment) => {
      if (!isObject(acc) || !Object.hasOwn(acc, pathSegment)) {
        return undefined;
      }

      return acc[pathSegment];
    },
    methods
  );

  return isFunction(result) ? result : undefined;
};

export const formatMethodPath = (methodPath: MethodPath) => {
  return methodPath.join('.');
};
