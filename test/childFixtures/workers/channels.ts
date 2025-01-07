import { connectToParentFromWorker, RemoteControl } from '../../../src/index';
import FixtureMethods from '../types/FixtureMethods';

let channelBParent: RemoteControl<Pick<FixtureMethods, 'getChannel'>>;

const channelBMethods = {
  getChannel() {
    return 'B';
  },
  getChannelFromParent() {
    return channelBParent?.getChannel();
  },
};

connectToParentFromWorker<
  Pick<FixtureMethods, 'getChannel' | 'getChannelFromParent'>
>({
  channel: 'B',
  methods: channelBMethods,
  debug: true,
}).promise.then((parent) => {
  channelBParent = parent;
});

let channelAParent: RemoteControl<Pick<
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

connectToParentFromWorker<
  Pick<FixtureMethods, 'getChannel' | 'getChannelFromParent'>
>({
  channel: 'A',
  methods: channelAMethods,
  debug: true,
}).promise.then((parent) => {
  channelAParent = parent;
});
