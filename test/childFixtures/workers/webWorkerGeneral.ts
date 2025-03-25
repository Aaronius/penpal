import { connect, debug, Reply, WorkerMessenger } from '../../../src/index.js';
import FixtureMethods from '../types/FixtureMethods.js';

declare const self: DedicatedWorkerGlobalScope;

console.log('worker origin', self.origin);

type ParentAPI = Record<'add', (num1: number, num2: number) => Promise<number>>;

let parentAPI: ParentAPI;
let parentReturnValue: number;

const messenger = new WorkerMessenger({
  worker: self,
});

const methods: Omit<
  FixtureMethods,
  | 'reload'
  | 'navigate'
  | 'methodNotInGeneralPage'
  | 'getChannel'
  | 'getChannelFromParent'
> = {
  multiply(num1: number, num2: number) {
    return num1 * num2;
  },
  multiplyAsync(num1: number, num2: number) {
    return new Promise(function (resolve) {
      resolve(num1 * num2);
    });
  },
  double(numbersArray: Int32Array) {
    const resultArray = numbersArray.map((num) => num * 2);
    return new Reply(resultArray, {
      transferables: [resultArray.buffer],
    });
  },
  multiplyWithPromisedReplyInstanceAndPromisedReturnValue(num1, num2) {
    return Promise.resolve(new Reply(Promise.resolve(num1 * num2)));
  },
  addUsingParent() {
    return parentAPI.add(3, 6).then(function (value: number) {
      parentReturnValue = value;
    });
  },
  getParentReturnValue() {
    return parentReturnValue;
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
    // Using TypeError instead of Error just to make sure the "name" property
    // on the error instance gets properly serialized.
    return Promise.reject(new TypeError('test error object'));
  },
  throwError() {
    throw new Error('Oh nos!');
  },
  getUnclonableValue() {
    return self;
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
    oneLevel(input) {
      return input;
    },
    by: {
      twoLevels(input) {
        return input;
      },
    },
  },
  neverResolve() {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return new Promise(() => {});
  },
  ['with.period']: () => {
    return 'success';
  },
};

connect<ParentAPI>({
  messenger,
  methods: methods,
  log: debug('Child'),
}).promise.then((parent) => {
  parentAPI = parent;
});
