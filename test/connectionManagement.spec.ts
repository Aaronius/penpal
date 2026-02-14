import { CHILD_SERVER } from './constants.js';
import {
  createAndAddIframe,
  createWorkerAndConnection,
  getWorkerFixtureUrl,
  expectNeverFulfilledIframeConnection,
  getPageFixtureUrl,
} from './utils.js';
import {
  connect,
  PenpalError,
  PortMessenger,
  WindowMessenger,
} from '../src/index.js';
import type { Methods, RemoteProxy } from '../src/index.js';
import FixtureMethods from './childFixtures/types/FixtureMethods.js';
import WorkerMessenger from '../src/messengers/WorkerMessenger.js';
import {
  isAck2Message,
  isAck1Message,
  isMessage,
  isSynMessage,
} from '../src/guards.js';

type CreateWindowConnectionOptions = {
  remoteWindow: Window;
  allowedOrigins?: (string | RegExp)[];
  methods?: Methods;
  timeout?: number;
  channel?: string;
};

type CreateIframeConnectionOptions = Omit<
  CreateWindowConnectionOptions,
  'remoteWindow'
> & {
  pageName?: string;
  url?: string;
};

type ChannelParentMethods = {
  getChannel(): string;
};

type ChannelChildMethods = Pick<
  FixtureMethods,
  'getChannel' | 'getChannelFromParent'
>;

const expectParallelChannelResults = async (
  channelAChild: RemoteProxy<ChannelChildMethods>,
  channelBChild: RemoteProxy<ChannelChildMethods>
) => {
  const results = await Promise.all([
    channelAChild.getChannel(),
    channelBChild.getChannel(),
    channelAChild.getChannelFromParent(),
    channelBChild.getChannelFromParent(),
  ]);

  expect(results).toEqual(['A', 'B', 'A', 'B']);
};

const createWindowConnection = <TMethods extends Methods>({
  remoteWindow,
  allowedOrigins,
  methods,
  timeout,
  channel,
}: CreateWindowConnectionOptions) => {
  const messenger = new WindowMessenger({
    remoteWindow,
    ...(allowedOrigins === undefined ? {} : { allowedOrigins }),
  });

  return connect<TMethods>({
    messenger,
    ...(methods === undefined ? {} : { methods }),
    ...(timeout === undefined ? {} : { timeout }),
    ...(channel === undefined ? {} : { channel }),
  });
};

const createIframeConnection = <TMethods extends Methods>({
  ...options
}: CreateIframeConnectionOptions = {}) => {
  const { pageName = 'general', url, methods, timeout, channel } = options;
  const hasAllowedOriginsOption = Object.prototype.hasOwnProperty.call(
    options,
    'allowedOrigins'
  );
  const allowedOrigins = hasAllowedOriginsOption
    ? options.allowedOrigins
    : [CHILD_SERVER];

  const iframe = createAndAddIframe(url ?? getPageFixtureUrl(pageName));

  const connection = createWindowConnection<TMethods>({
    remoteWindow: iframe.contentWindow!,
    ...(allowedOrigins === undefined ? {} : { allowedOrigins }),
    ...(methods === undefined ? {} : { methods }),
    ...(timeout === undefined ? {} : { timeout }),
    ...(channel === undefined ? {} : { channel }),
  });

  return { iframe, connection };
};

const getAlternateFixtureOrigin = () => {
  const url = new URL(CHILD_SERVER);
  url.hostname = url.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
  return url.origin;
};

const getRedirectPageUrl = () => {
  const redirectToUrl = encodeURIComponent(
    getPageFixtureUrl('general', getAlternateFixtureOrigin())
  );
  return `${getPageFixtureUrl('redirect')}?to=${redirectToUrl}`;
};

describe('connection management', () => {
  it('connects to window when correct origin provided in parent', async () => {
    const { connection } = createIframeConnection<FixtureMethods>();

    await connection.promise;
    connection.destroy();
  });

  it('connects to window when correct origin regex provided in parent', async () => {
    const { connection } = createIframeConnection({
      allowedOrigins: [/^http/],
    });

    await connection.promise;
    connection.destroy();
  });

  it('connects to worker', async () => {
    const connection = createWorkerAndConnection({
      workerName: 'webWorkerGeneral',
    });

    await connection.promise;
    connection.destroy();
  });

  it('connects to window when matching origin provided in child', async () => {
    const { connection } = createIframeConnection({
      pageName: 'matchingParentOrigin',
      allowedOrigins: ['http://example.com', CHILD_SERVER],
    });

    await connection.promise;
    connection.destroy();
  });

  it('connects to window when matching origin regex provided in child', async () => {
    const { connection } = createIframeConnection({
      pageName: 'matchingParentOriginRegex',
      allowedOrigins: ['http://example.com', CHILD_SERVER],
    });

    await connection.promise;
    connection.destroy();
  });

  it("doesn't connect to window when incorrect origin provided in parent", async () => {
    const { iframe, connection } = createIframeConnection({
      allowedOrigins: ['http://example.com'],
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it("doesn't connect to window when mismatched origin provided in child", async () => {
    const { iframe, connection } = createIframeConnection({
      pageName: 'mismatchedParentOrigin',
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it("doesn't connect to window when mismatched parent origin regex provided in child", async () => {
    const { iframe, connection } = createIframeConnection({
      pageName: 'mismatchedParentOriginRegex',
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it('connects to window when child redirects to different origin and origin is set to * in parent', async () => {
    const { connection } = createIframeConnection({
      url: getRedirectPageUrl(),
      allowedOrigins: ['*'],
    });

    await connection.promise;
    connection.destroy();
  });

  it('connects to window when parent and child are on the same origin and origin is not set in parent or child', async () => {
    const { connection } = createIframeConnection({
      url: '/pages/noParentOrigin.html',
      allowedOrigins: undefined,
    });

    await connection.promise;
    connection.destroy();
  });

  it("doesn't connect to window when child redirects to different origin and origin is not set in parent", async () => {
    const { iframe, connection } = createIframeConnection({
      url: getRedirectPageUrl(),
      allowedOrigins: undefined,
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it("doesn't connect to window when child redirects to different origin and origin is set to a mismatched origin in parent", async () => {
    const { iframe, connection } = createIframeConnection({
      url: getRedirectPageUrl(),
      allowedOrigins: [CHILD_SERVER],
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it("doesn't connect to window when child redirects to different origin and origin is set to a mismatched origin regex in parent", async () => {
    const { iframe, connection } = createIframeConnection({
      url: getRedirectPageUrl(),
      allowedOrigins: [/example\.com/],
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it("doesn't connect to window when no origin set in child", async () => {
    const { iframe, connection } = createIframeConnection({
      pageName: 'noParentOrigin',
      allowedOrigins: [CHILD_SERVER],
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it('reconnects after child reloads', async () => {
    const { iframe, connection } = createIframeConnection<FixtureMethods>();

    const child = await connection.promise;

    return new Promise<void>((resolve) => {
      const handleMessage = async (event: MessageEvent) => {
        if (
          event.source === iframe.contentWindow &&
          isMessage(event.data) &&
          (isAck1Message(event.data) || isAck2Message(event.data))
        ) {
          window.removeEventListener('message', handleMessage);
          child.multiply(2, 4).then((value: number) => {
            expect(value).toEqual(8);
            connection.destroy();
            resolve();
          });
        }
      };

      window.addEventListener('message', handleMessage);
      child.reload();
    });
  });

  it('rejects method calls during reconnect with transmission error', async () => {
    const { iframe, connection } = createIframeConnection<FixtureMethods>();

    const child = await connection.promise;

    const result = await new Promise<unknown>((resolve) => {
      const handleMessage = (event: MessageEvent) => {
        if (
          event.source === iframe.contentWindow &&
          isMessage(event.data) &&
          isSynMessage(event.data)
        ) {
          window.removeEventListener('message', handleMessage);

          child.multiply(2, 4).then(resolve, resolve);
        }
      };

      window.addEventListener('message', handleMessage);
      child.reload();
    });

    expect(result).toEqual(expect.any(PenpalError));
    expect((result as PenpalError).code).toBe('TRANSMISSION_FAILED');
    expect((result as Error).message).not.toContain(
      "You've hit a bug in Penpal"
    );

    connection.destroy();
  });

  it('destroys other side of connection when connection is destroyed', async () => {
    const { iframe, connection } = createIframeConnection({
      pageName: 'connectionDestroyedProbe',
      methods: {
        add(num1: number, num2: number) {
          return num1 + num2;
        },
      },
    });

    await connection.promise;
    connection.destroy();

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(
          new Error('Timed out waiting for connection-destroyed probe result')
        );
      }, 5000);

      const handleMessage = (event: MessageEvent) => {
        if (event.source !== iframe.contentWindow) {
          return;
        }

        const payload = event.data;

        if (
          !payload ||
          typeof payload !== 'object' ||
          payload.fixture !== 'connectionDestroyedProbe'
        ) {
          return;
        }

        if (payload.type === 'RESULT') {
          clearTimeout(timeout);
          window.removeEventListener('message', handleMessage);
          reject(
            new Error(
              `Expected parent call to fail after destroy, but it succeeded with value ${
                payload.result as number
              }`
            )
          );
          return;
        }

        if (payload.type === 'RESULT_ERROR') {
          clearTimeout(timeout);
          window.removeEventListener('message', handleMessage);
          expect(payload.code).toBe('CONNECTION_DESTROYED');
          resolve();
        }
      };

      window.addEventListener('message', handleMessage);
      iframe.contentWindow!.postMessage(
        {
          fixture: 'connectionDestroyedProbe',
          type: 'REQUEST_ADD_USING_PARENT',
        },
        CHILD_SERVER
      );
    });
  });

  it('reconnects after child navigates to other page with different methods', async () => {
    const { iframe, connection } = createIframeConnection<FixtureMethods>();

    const child = await connection.promise;

    return new Promise<void>((resolve, reject) => {
      const handleMessage = async (event: MessageEvent) => {
        if (
          event.source === iframe.contentWindow &&
          isMessage(event.data) &&
          (isAck1Message(event.data) || isAck2Message(event.data))
        ) {
          window.removeEventListener('message', handleMessage);
          try {
            const result = await child.methodNotInGeneralPage();
            expect(result).toBe('success');
          } catch (error) {
            reject(error);
          }

          try {
            // This should fail because `multiply` is not a method exposed
            // by the new page.
            await child.multiply(2, 4);
            reject(new Error('Successful call not expected'));
          } catch (error) {
            expect((error as PenpalError).code).toEqual('METHOD_NOT_FOUND');
            resolve();
          }
        }
      };

      window.addEventListener('message', handleMessage);
      child.navigate('/pages/methodNotInGeneralPage.html');
    });
  });

  it('rejects promise if connection timeout passes', async () => {
    const { connection } = createIframeConnection<FixtureMethods>({
      url: `${CHILD_SERVER}/never-respond`,
      timeout: 0,
    });

    let error;
    try {
      await connection.promise;
    } catch (e) {
      error = e;
    }
    expect(error).toEqual(expect.any(Error));
    expect((error as Error).message).toBe('Connection timed out after 0ms');
    expect((error as PenpalError).code).toBe('CONNECTION_TIMEOUT');
    connection.destroy();
  });

  it("doesn't destroy connection if connection succeeds then timeout passes", async () => {
    vi.useFakeTimers();

    const { iframe, connection } = createIframeConnection<FixtureMethods>();

    await connection.promise;
    vi.advanceTimersByTime(10000);

    expect(iframe.parentNode).not.toBeNull();

    connection.destroy();
  });

  it('connects to window in parallel with separate channels', async () => {
    const iframe = createAndAddIframe(getPageFixtureUrl('channels'));

    // We try to connect and make method calls on both
    // children as simultaneous as possible to make the test more robust by
    // trying to trip up the logic in our code.

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

    const channelAMessenger = new WorkerMessenger({
      worker,
    });

    // We try to connect and make method calls on both
    // children as simultaneous as possible to make the test more robust by
    // trying to trip up the logic in our code.

    const channelAConnection = connect<FixtureMethods>({
      messenger: channelAMessenger,
      channel: 'A',
      methods: {
        getChannel() {
          return 'A';
        },
      },
    });

    const channelBMessenger = new WorkerMessenger({
      worker,
    });

    const channelBConnection = connect<FixtureMethods>({
      messenger: channelBMessenger,
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

  it('connects to window created with window.open()', async () => {
    const childWindow = window.open(getPageFixtureUrl('openedWindow'));

    try {
      const connection = createWindowConnection({
        remoteWindow: childWindow!,
        allowedOrigins: [CHILD_SERVER],
      });

      await connection.promise;
      connection.destroy();
    } finally {
      childWindow?.close();
    }
  });

  it('connects to shared worker', async () => {
    const worker = new SharedWorker(getWorkerFixtureUrl('sharedWorker'));

    const messenger = new PortMessenger({
      port: worker.port,
    });

    const connection = connect<FixtureMethods>({
      messenger,
      methods: {
        add(num1: number, num2: number) {
          return num1 + num2;
        },
      },
    });

    const child = await connection.promise;

    await expect(child.multiply(3, 2)).resolves.toBe(6);
    await child.addUsingParent();
    await expect(child.getParentReturnValue()).resolves.toBe(9);

    connection.destroy();
  });

  it('connects to service worker', async () => {
    const waitForController = async () => {
      if (navigator.serviceWorker.controller) {
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timed out waiting for service worker controller'));
        }, 5000);

        const handleControllerChange = () => {
          clearTimeout(timeout);
          navigator.serviceWorker.removeEventListener(
            'controllerchange',
            handleControllerChange
          );
          resolve();
        };

        navigator.serviceWorker.addEventListener(
          'controllerchange',
          handleControllerChange
        );

        // This specific path is very important. Due to browser security, the
        // service worker file must be loaded from the root directory in order for
        // the service worker to be able to control the page the tests are
        // running in. Learn more by looking up "service worker scope".
        navigator.serviceWorker.register('/serviceWorker.js').catch((error) => {
          clearTimeout(timeout);
          navigator.serviceWorker.removeEventListener(
            'controllerchange',
            handleControllerChange
          );
          reject(error);
        });
      });
    };

    const initPenpal = async () => {
      const { port1, port2 } = new MessageChannel();

      navigator.serviceWorker.controller?.postMessage(
        {
          type: 'INIT_PENPAL',
          port: port2,
        },
        {
          transfer: [port2],
        }
      );

      const messenger = new PortMessenger({
        port: port1,
      });

      const connection = connect<FixtureMethods>({
        messenger,
        methods: {
          add(num1: number, num2: number) {
            return num1 + num2;
          },
        },
      });

      const child = await connection.promise;
      await expect(child.multiply(3, 2)).resolves.toBe(6);
      await child.addUsingParent();
      await expect(child.getParentReturnValue()).resolves.toBe(9);

      connection.destroy();
    };

    await waitForController();
    await initPenpal();
  });
});
