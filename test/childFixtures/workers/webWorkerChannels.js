importScripts('/penpal.js');

console.log('worker origin', self.origin);

const channelBParentPromise = Penpal.connect({
  messenger: new Penpal.WorkerMessenger({
    worker: self,
  }),
  channel: 'B',
  methods: {
    getChannel() {
      return 'B';
    },
    getChannelFromParent() {
      return channelBParentPromise.then((parent) => parent.getChannel());
    },
  },
  log: Penpal.debug('Child Connection B'),
}).promise;

const channelAParentPromise = Penpal.connect({
  messenger: new Penpal.WorkerMessenger({
    worker: self,
  }),
  channel: 'A',
  methods: {
    getChannel() {
      return 'A';
    },
    getChannelFromParent() {
      return channelAParentPromise.then((parent) => parent.getChannel());
    },
  },
  log: Penpal.debug('Child Connection A'),
}).promise;
