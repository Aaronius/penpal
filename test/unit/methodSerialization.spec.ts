import { describe, expect, it } from 'vitest';
import {
  extractMethodPathsFromMethods,
  formatMethodPath,
  getMethodAtMethodPath,
} from '../../src/methodSerialization.js';
import type { Methods } from '../../src/types.js';

describe('method serialization', () => {
  it('extracts nested method paths from methods object', () => {
    const methods = {
      multiply() {
        return undefined;
      },
      nested: {
        oneLevel() {
          return undefined;
        },
        by: {
          twoLevels() {
            return undefined;
          },
        },
      },
      nonFunctionValue: 'ignore me',
    };

    const methodPaths = extractMethodPathsFromMethods(methods);

    expect(methodPaths).toEqual([
      ['multiply'],
      ['nested', 'oneLevel'],
      ['nested', 'by', 'twoLevels'],
    ]);
  });

  it('gets method at method path', () => {
    const multiply = (num1: number, num2: number) => {
      return num1 * num2;
    };

    const methods = {
      nested: {
        multiply,
      },
    };

    expect(getMethodAtMethodPath(['nested', 'multiply'], methods)).toBe(
      multiply
    );
    expect(
      getMethodAtMethodPath(['nested', 'missing'], methods)
    ).toBeUndefined();
  });

  it('does not get methods from the prototype chain', () => {
    class MethodApi {
      inheritedMethod() {
        return undefined;
      }
    }

    const methods = new MethodApi() as Methods;

    expect(getMethodAtMethodPath(['inheritedMethod'], methods)).toBeUndefined();
  });

  it('does not get nested methods from the prototype chain', () => {
    const inheritedMethod = () => {
      return undefined;
    };
    const nested = Object.create({
      inheritedMethod,
    }) as Methods;
    const methods = {
      nested,
    };

    expect(
      getMethodAtMethodPath(['nested', 'inheritedMethod'], methods)
    ).toBeUndefined();
  });

  it('formats method path', () => {
    expect(formatMethodPath(['nested', 'by', 'twoLevels'])).toBe(
      'nested.by.twoLevels'
    );
  });
});
