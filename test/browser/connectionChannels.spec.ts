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
  CallOptions,
  connect,
  PenpalError,
  PortMessenger,
  WindowMessenger,
} from '../../src/index.js';
import type { RemoteProxy } from '../../src/index.js';
import { CHILD_SERVER } from './constants.js';
import type FixtureMethods from './fixtures/types/FixtureMethods.js';
import WebWorkerMessenger from '../../src/messengers/WebWorkerMessenger.js';

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
      messenger: new WebWorkerMessenger({ worker }),
      channel: 'A',
      methods: {
        getChannel() {
          return 'A';
        },
      },
    });

    const channelBConnection = connect<FixtureMethods>({
      messenger: new WebWorkerMessenger({ worker }),
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

  it('keeps a connection working after another on the same ports is destroyed', async () => {
    const { port1, port2 } = new MessageChannel();

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

    const channelAParentPromise = channelAParentConnection.promise as Promise<
      RemoteProxy<ChannelParentMethods>
    >;
    const channelBParentPromise = channelBParentConnection.promise as Promise<
      RemoteProxy<ChannelParentMethods>
    >;

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
          return channelAParentPromise.then((parent) => parent.getChannel());
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
          return channelBParentPromise.then((parent) => parent.getChannel());
        },
      },
    });

    try {
      const [channelAChild, channelBChild, , channelBParent] =
        await Promise.all([
          channelAParentConnection.promise,
          channelBParentConnection.promise,
          channelAChildConnection.promise,
          channelBChildConnection.promise,
        ]);

      await expectParallelChannelResults(channelAChild, channelBChild);

      channelAParentConnection.destroy();
      const options = new CallOptions({ timeout: 1000 });
      await expect(channelBChild.getChannel(options)).resolves.toBe('B');
      await expect(channelBParent.getChannel(options)).resolves.toBe('B');
    } finally {
      channelAParentConnection.destroy();
      channelBParentConnection.destroy();
      channelAChildConnection.destroy();
      channelBChildConnection.destroy();
      port1.close();
      port2.close();
    }
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
      let error: unknown;

      try {
        connect<FixtureMethods>({
          messenger,
        });
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).toEqual(expect.any(PenpalError));
      expect((error as PenpalError).code).toBe('INVALID_ARGUMENT');
    } finally {
      await connection.promise.catch(() => undefined);
      connection.destroy();
    }
  });
});
