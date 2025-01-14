import { connectToParent, RemoteMethodProxies } from '../../../src/index';
import FixtureMethods from '../types/FixtureMethods';

let channelBParent: RemoteMethodProxies<Pick<FixtureMethods, 'getChannel'>>;

const channelBMethods = {
  getChannel() {
    return 'B';
  },
  getChannelFromParent() {
    return channelBParent?.getChannel();
  },
};

connectToParent<Pick<FixtureMethods, 'getChannel' | 'getChannelFromParent'>>({
  channel: 'B',
  methods: channelBMethods,
  debug: true,
}).promise.then((parent) => {
  channelBParent = parent;
});

let channelAParent: RemoteMethodProxies<Pick<
  FixtureMethods,
  'getChannel' | 'getChannelFromParent'
>>;

const channelAMethods = {
  getChannel() {
    return 'A';
  },
  getChannelFromParent() {
    return channelAParent.getChannel();
  },
};

connectToParent<Pick<FixtureMethods, 'getChannel' | 'getChannelFromParent'>>({
  channel: 'A',
  methods: channelAMethods,
  debug: true,
}).promise.then((parent) => {
  channelAParent = parent;
});
