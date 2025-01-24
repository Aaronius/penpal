import {
  connectToParent,
  debug,
  Reply,
  WorkerMessenger,
} from '../../../src/index';
import FixtureMethods from '../types/FixtureMethods';
console.log('web worker origin', self.location.origin);
type ParentAPI = Record<'add', (num1: number, num2: number) => Promise<number>>;

let parentAPI: ParentAPI;
let parentReturnValue: number;

const messenger = new WorkerMessenger({
  worker: self,
  log: debug('Child'),
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
  multiplyUsingTransferables(num1DataView: DataView, num2DataView: DataView) {
    const num1 = num1DataView.getInt32(0);
    const num2 = num2DataView.getInt32(0);
    const returnValue = new DataView(new ArrayBuffer(4));
    returnValue.setInt32(0, num1 * num2);
    return new Reply(returnValue, {
      transferables: [returnValue.buffer],
    });
  },
  multiplyWithPromisedReplyInstanceAndPromisedReturnValue(num1, num2) {
    return Promise.resolve(new Reply(Promise.resolve(num1 * num2)));
  },
  addUsingParent() {
    parentAPI.add(3, 6).then(function (value: number) {
      parentReturnValue = value;
    });
  },
  getParentReturnValue() {
    return parentReturnValue;
  },
  getPromiseRejectedWithString() {
    return Promise.reject('test error string');
  },
  getPromiseRejectedWithError() {
    // Using TypeError instead of Error just to make sure the "name" property
    // on the error instance gets properly serialized.
    return Promise.reject(new TypeError('test error object'));
  },
  getPromiseRejectedWithUndefined() {
    return Promise.reject();
  },
  throwError() {
    throw new Error('Oh nos!');
  },
  getUnclonableValue() {
    return self;
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
};

connectToParent<ParentAPI>({
  messenger,
  methods: methods,
}).promise.then((parent) => {
  parentAPI = parent;
});
