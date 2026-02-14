import { Reply } from '../src/index.js';
import type { Methods, RemoteProxy } from '../src/index.js';

type CreateGeneralFixtureMethodsOptions = {
  getParentApi: () => Promise<RemoteProxy<Methods>>;
  setParentReturnValue: (value: number) => void;
  getParentReturnValue: () => number | undefined;
  getUnclonableValue: () => unknown;
  reload?: () => void;
  navigate?: (to: string) => void;
};

export const createGeneralFixtureMethods = ({
  getParentApi,
  setParentReturnValue,
  getParentReturnValue,
  getUnclonableValue,
  reload,
  navigate,
}: CreateGeneralFixtureMethodsOptions): Methods => {
  const methods: Methods = {
    multiply(num1: number, num2: number) {
      return num1 * num2;
    },
    multiplyAsync(num1: number, num2: number) {
      return Promise.resolve(num1 * num2);
    },
    double(numbersArray: Int32Array) {
      const resultArray = numbersArray.map((num) => num * 2);
      return new Reply(resultArray, {
        transferables: [resultArray.buffer],
      });
    },
    multiplyWithPromisedReplyInstanceAndPromisedReturnValue(
      num1: number,
      num2: number
    ) {
      return Promise.resolve(new Reply(Promise.resolve(num1 * num2)));
    },
    addUsingParent() {
      return getParentApi()
        .then((parentProxy) => parentProxy.add(3, 6))
        .then((value) => {
          setParentReturnValue(value as number);
        });
    },
    getParentReturnValue() {
      return getParentReturnValue();
    },
    getPromiseRejectedWithString() {
      return Promise.reject('test error string');
    },
    getPromiseRejectedWithObject() {
      return Promise.reject({ a: 'b' });
    },
    getPromiseRejectedWithUndefined() {
      return Promise.reject();
    },
    getPromiseRejectedWithError() {
      return Promise.reject(new TypeError('test error object'));
    },
    throwError() {
      throw new Error('Oh nos!');
    },
    getUnclonableValue() {
      return getUnclonableValue();
    },
    apply() {
      return 'apply result';
    },
    call() {
      return 'call result';
    },
    bind() {
      return 'bind result';
    },
    nested: {
      oneLevel(input: unknown) {
        return input;
      },
      by: {
        twoLevels(input: unknown) {
          return input;
        },
      },
      apply() {
        return 'apply result';
      },
    },
    neverResolve() {
      return new Promise(() => {
        // Intentionally never resolves.
      });
    },
    ['with.period']() {
      return 'success';
    },
  };

  if (reload) {
    methods.reload = () => {
      reload();
    };
  }

  if (navigate) {
    methods.navigate = (to: string) => {
      navigate(to);
    };
  }

  return methods;
};
