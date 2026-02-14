importScripts('/penpal.js');

console.log('worker origin', self.origin);

let parentAPI;
let parentReturnValue;

const messenger = new Penpal.WorkerMessenger({
  worker: self,
});

const methods = {
  multiply(num1, num2) {
    return num1 * num2;
  },
  multiplyAsync(num1, num2) {
    return new Promise((resolve) => {
      resolve(num1 * num2);
    });
  },
  double(numbersArray) {
    const resultArray = numbersArray.map((num) => num * 2);
    return new Penpal.Reply(resultArray, {
      transferables: [resultArray.buffer],
    });
  },
  multiplyWithPromisedReplyInstanceAndPromisedReturnValue(num1, num2) {
    return Promise.resolve(new Penpal.Reply(Promise.resolve(num1 * num2)));
  },
  addUsingParent() {
    return parentAPI.add(3, 6).then((value) => {
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
    apply() {
      return 'apply result';
    },
  },
  neverResolve() {
    return new Promise(() => {});
  },
  ['with.period']() {
    return 'success';
  },
};

Penpal.connect({
  messenger,
  methods,
  log: Penpal.debug('Child'),
}).promise.then((parent) => {
  parentAPI = parent;
});
