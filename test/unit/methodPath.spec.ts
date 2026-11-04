import { describe, expect, it } from 'vitest';
import {
  formatMethodPath,
  getMethodAtMethodPath,
} from '../../src/methodPath.js';

describe('method path', () => {
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
      multiply,
    );
    expect(
      getMethodAtMethodPath(['nested', 'missing'], methods),
    ).toBeUndefined();
  });

  it('does not get methods from the prototype chain', () => {
    class MethodApi {
      inheritedMethod() {
        return undefined;
      }
    }

    const methods = new MethodApi();

    expect(getMethodAtMethodPath(['inheritedMethod'], methods)).toBeUndefined();
  });

  it('only resolves callable properties in an implementation object', () => {
    const add = (a: number, b: number) => a + b;
    const methods = { math: { add, label: 'calculator' }, version: 1 };

    expect(getMethodAtMethodPath(['math', 'add'], methods)).toBe(add);
    expect(getMethodAtMethodPath(['math', 'label'], methods)).toBeUndefined();
    expect(getMethodAtMethodPath(['version'], methods)).toBeUndefined();
  });

  it('does not get nested methods from the prototype chain', () => {
    const inheritedMethod = () => {
      return undefined;
    };
    const nested = Object.create({
      inheritedMethod,
    });
    const methods = {
      nested,
    };

    expect(
      getMethodAtMethodPath(['nested', 'inheritedMethod'], methods),
    ).toBeUndefined();
  });

  it('formats method path', () => {
    expect(formatMethodPath(['nested', 'by', 'twoLevels'])).toBe(
      'nested.by.twoLevels',
    );
  });
});
