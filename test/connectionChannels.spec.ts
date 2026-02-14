import {
  createAndAddIframe,
  getPageFixtureUrl,
  getWorkerFixtureUrl,
} from './utils.js';
import {
  createWindowConnection,
  expectParallelChannelResults,
} from './connectionManagementHelpers.js';
import {
  connect,
  PenpalError,
  PortMessenger,
  WindowMessenger,
} from '../src/index.js';
import type { RemoteProxy } from '../src/index.js';
import { CHILD_SERVER } from './constants.js';
import FixtureMethods from './childFixtures/types/FixtureMethods.js';
import WorkerMessenger from '../src/messengers/WorkerMessenger.js';

type ChannelParentMethods = {
  getChannel(): string;
};

type ChannelChildMethods = Pick<
  FixtureMethods,
  'getChannel' | 'getChannelFromParent'
>;

describe('connection management: channels', () => {
  it('connects to window in parallel with separate channels', async () => {
    const iframe = createAndAddIframe(getPageFixtureUrl('channels'));

    const channelAConnection = createWindowConnection<FixtureMethods>({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
      channel: 'A',
      methods: {
        getChannel() {
          return 'A';
        },
      },
    });

    const channelBConnection = createWindowConnection<FixtureMethods>({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
      channel: 'B',
      methods: {
        getChannel() {
          return 'B';
        },
      },
    });

    const [channelAChild, channelBChild] = await Promise.all([
      channelAConnection.promise,
      channelBConnection.promise,
    ]);

    await expectParallelChannelResults(channelAChild, channelBChild);

    channelAConnection.destroy();
    channelBConnection.destroy();
  });

  it('connects to worker in parallel with separate channels', async () => {
    const worker = new Worker(getWorkerFixtureUrl('webWorkerChannels'));

    const channelAConnection = connect<FixtureMethods>({
      messenger: new WorkerMessenger({ worker }),
      channel: 'A',
      methods: {
        getChannel() {
          return 'A';
        },
      },
    });

    const channelBConnection = connect<FixtureMethods>({
      messenger: new WorkerMessenger({ worker }),
      channel: 'B',
      methods: {
        getChannel() {
          return 'B';
        },
      },
    });

    const [channelAChild, channelBChild] = await Promise.all([
      channelAConnection.promise,
      channelBConnection.promise,
    ]);

    await expectParallelChannelResults(channelAChild, channelBChild);

    channelAConnection.destroy();
    channelBConnection.destroy();
  });

  it('connects through message ports in parallel with separate channels', async () => {
    const { port1, port2 } = new MessageChannel();

    const channelAParentRef: {
      current?: RemoteProxy<ChannelParentMethods>;
    } = {};
    const channelBParentRef: {
      current?: RemoteProxy<ChannelParentMethods>;
    } = {};

    const channelAChildConnection = connect<ChannelParentMethods>({
      messenger: new PortMessenger({
        port: port2,
      }),
      channel: 'A',
      methods: {
        getChannel() {
          return 'A';
        },
        getChannelFromParent() {
          return channelAParentRef.current!.getChannel();
        },
      },
    });

    const channelBChildConnection = connect<ChannelParentMethods>({
      messenger: new PortMessenger({
        port: port2,
      }),
      channel: 'B',
      methods: {
        getChannel() {
          return 'B';
        },
        getChannelFromParent() {
          return channelBParentRef.current!.getChannel();
        },
      },
    });

    const channelAParentConnection = connect<ChannelChildMethods>({
      messenger: new PortMessenger({
        port: port1,
      }),
      channel: 'A',
      methods: {
        getChannel() {
          return 'A';
        },
      },
    });

    const channelBParentConnection = connect<ChannelChildMethods>({
      messenger: new PortMessenger({
        port: port1,
      }),
      channel: 'B',
      methods: {
        getChannel() {
          return 'B';
        },
      },
    });

    const [
      resolvedChannelAParent,
      resolvedChannelBParent,
      channelAChild,
      channelBChild,
    ] = await Promise.all([
      channelAChildConnection.promise,
      channelBChildConnection.promise,
      channelAParentConnection.promise,
      channelBParentConnection.promise,
    ]);

    channelAParentRef.current = resolvedChannelAParent;
    channelBParentRef.current = resolvedChannelBParent;

    await expectParallelChannelResults(channelAChild, channelBChild);

    channelAParentConnection.destroy();
    channelBParentConnection.destroy();
    channelAChildConnection.destroy();
    channelBChildConnection.destroy();
  });

  it('throws error when messenger is re-used', async () => {
    const iframe = createAndAddIframe(getPageFixtureUrl('general'));

    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });

    const connection = connect<FixtureMethods>({
      messenger,
    });

    try {
      try {
        connect<FixtureMethods>({
          messenger,
        });
      } catch (error) {
        expect(error).toEqual(expect.any(PenpalError));
        expect((error as PenpalError).code).toBe('INVALID_ARGUMENT');
        return;
      }

      throw new Error('Expected error to be thrown');
    } finally {
      connection.destroy();
    }
  });
});
