importScripts('/penpal.js');

console.log('worker origin', self.origin);

let channelBParent;

const channelBMessenger = new Penpal.WorkerMessenger({
  worker: self,
});

const channelBMethods = {
  getChannel() {
    return 'B';
  },
  getChannelFromParent() {
    return channelBParent.getChannel();
  },
};

Penpal.connect({
  messenger: channelBMessenger,
  channel: 'B',
  methods: channelBMethods,
  log: Penpal.debug('Child Connection B'),
}).promise.then((parent) => {
  channelBParent = parent;
});

let channelAParent;

const channelAMessenger = new Penpal.WorkerMessenger({
  worker: self,
});

const channelAMethods = {
  getChannel() {
    return 'A';
  },
  getChannelFromParent() {
    return channelAParent.getChannel();
  },
};

Penpal.connect({
  messenger: channelAMessenger,
  channel: 'A',
  methods: channelAMethods,
  log: Penpal.debug('Child Connection A'),
}).promise.then((parent) => {
  channelAParent = parent;
});
