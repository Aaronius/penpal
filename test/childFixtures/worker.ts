import { connectToParentFromWorker, withMessageOptions } from '../../src/index';
console.log('web worker origin', self.location.origin);
type ParentAPI = Record<'add', (num1: number, num2: number) => Promise<number>>;

let parentAPI: ParentAPI;
var parentReturnValue: number;

var methods = {
  multiply: function (num1: number, num2: number) {
    return num1 * num2;
  },
  multiplyAsync: function (num1: number, num2: number) {
    return new Promise(function (resolve) {
      resolve(num1 * num2);
    });
  },
  multiplyUsingTransferables: function (
    num1DataView: DataView,
    num2DataView: DataView
  ) {
    const num1 = num1DataView.getInt32(0);
    const num2 = num2DataView.getInt32(0);
    const returnValue = new DataView(new ArrayBuffer(4));
    returnValue.setInt32(0, num1 * num2);
    return withMessageOptions(returnValue, {
      transfer: [returnValue.buffer],
    });
  },
  addUsingParent: function () {
    parentAPI.add(3, 6).then(function (value: number) {
      parentReturnValue = value;
    });
  },
  getParentReturnValue: function () {
    return parentReturnValue;
  },
  getRejectedPromiseString: function () {
    return Promise.reject('test error string');
  },
  getRejectedPromiseError: function () {
    // TypeError instead of Error just to make sure "name" transfers properly.
    return Promise.reject(new TypeError('test error object'));
  },
  throwError: function () {
    throw new Error('Oh nos!');
  },
  getUnclonableValue: function () {
    return self;
  },
  nested: {
    oneLevel: function (input: unknown) {
      return input;
    },
    by: {
      twoLevels: function (input: unknown) {
        return input;
      },
    },
  },
};

connectToParentFromWorker({
  methods: methods,
  debug: true,
}).promise.then(function (parent) {
  parentAPI = (parent as unknown) as ParentAPI;
});
