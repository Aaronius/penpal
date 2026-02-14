importScripts('/penpal.js');
importScripts('/shared/generalMethods.js');

console.log('worker origin', self.origin);

let parentReturnValue;
let parentApiPromise;

const messenger = new Penpal.WorkerMessenger({
  worker: self,
});

const methods = PenpalGeneralFixtureMethods.createGeneralMethods({
  getParentApi: () => parentApiPromise,
  setParentReturnValue: (value) => {
    parentReturnValue = value;
  },
  getParentReturnValue: () => {
    return parentReturnValue;
  },
  getUnclonableValue: () => {
    return self;
  },
  createReply: (value, options) => {
    return new Penpal.Reply(value, options);
  },
});

parentApiPromise = Penpal.connect({
  messenger,
  methods,
  log: Penpal.debug('Child'),
}).promise;
