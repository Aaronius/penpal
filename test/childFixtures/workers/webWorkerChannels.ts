import {
  connectToParent,
  WorkerMessenger,
  RemoteMethodProxies,
  debug,
} from '../../../src/index';
import FixtureMethods from '../types/FixtureMethods';

declare const self: DedicatedWorkerGlobalScope;

console.log('worker origin', self.origin);

let channelBParent: RemoteMethodProxies<Pick<FixtureMethods, 'getChannel'>>;

const channelBMessenger = new WorkerMessenger({
  worker: self,
  channel: 'B',
});

const channelBMethods = {
  getChannel() {
    return 'B';
  },
  getChannelFromParent() {
    return channelBParent?.getChannel();
  },
};

connectToParent<Pick<FixtureMethods, 'getChannel' | 'getChannelFromParent'>>({
  messenger: channelBMessenger,
  methods: channelBMethods,
  log: debug('Child Connection B'),
}).promise.then((parent) => {
  channelBParent = parent;
});

let channelAParent: RemoteMethodProxies<Pick<
  FixtureMethods,
  'getChannel' | 'getChannelFromParent'
>>;

const channelAMessenger = new WorkerMessenger({
  worker: self,
  channel: 'A',
});

const channelAMethods = {
  getChannel() {
    return 'A';
  },
  getChannelFromParent() {
    return channelAParent.getChannel();
  },
};

connectToParent<Pick<FixtureMethods, 'getChannel' | 'getChannelFromParent'>>({
  messenger: channelAMessenger,
  methods: channelAMethods,
  log: debug('Child Connection A'),
}).promise.then((parent) => {
  channelAParent = parent;
});
