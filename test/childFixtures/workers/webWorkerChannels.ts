import {
  connect,
  WorkerMessenger,
  RemoteProxy,
  debug,
} from '../../../src/index.js';
import FixtureMethods from '../types/FixtureMethods.js';

declare const self: DedicatedWorkerGlobalScope;

console.log('worker origin', self.origin);

let channelBParent: RemoteProxy<Pick<FixtureMethods, 'getChannel'>>;

const channelBMessenger = new WorkerMessenger({
  worker: self,
});

const channelBMethods = {
  getChannel() {
    return 'B';
  },
  getChannelFromParent() {
    return channelBParent?.getChannel();
  },
};

connect<Pick<FixtureMethods, 'getChannel' | 'getChannelFromParent'>>({
  messenger: channelBMessenger,
  channel: 'B',
  methods: channelBMethods,
  log: debug('Child Connection B'),
}).promise.then((parent) => {
  channelBParent = parent;
});

let channelAParent: RemoteProxy<Pick<
  FixtureMethods,
  'getChannel' | 'getChannelFromParent'
>>;

const channelAMessenger = new WorkerMessenger({
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

connect<Pick<FixtureMethods, 'getChannel' | 'getChannelFromParent'>>({
  messenger: channelAMessenger,
  channel: 'A',
  methods: channelAMethods,
  log: debug('Child Connection A'),
}).promise.then((parent) => {
  channelAParent = parent;
});
