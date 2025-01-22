import {
  connectToParent,
  ChildWorkerToParentMessenger,
  RemoteMethodProxies,
} from '../../../src/index';
import FixtureMethods from '../types/FixtureMethods';

let channelBParent: RemoteMethodProxies<Pick<FixtureMethods, 'getChannel'>>;

const channelBMessenger = new ChildWorkerToParentMessenger({
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
  debug: true,
}).promise.then((parent) => {
  channelBParent = parent;
});

let channelAParent: RemoteMethodProxies<Pick<
  FixtureMethods,
  'getChannel' | 'getChannelFromParent'
>>;

const channelAMessenger = new ChildWorkerToParentMessenger({
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
  debug: true,
}).promise.then((parent) => {
  channelAParent = parent;
});
