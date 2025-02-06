import { CHILD_SERVER, CHILD_SERVER_ALTERNATE } from './constants';
import {
  createAndAddIframe,
  getWorkerFixtureUrl,
  expectNeverFulfilledIframeConnection,
  getPageFixtureUrl,
} from './utils';
import {
  connectToChild,
  ErrorCode,
  PenpalError,
  PortMessenger,
  WindowMessenger,
} from '../src/index';
import FixtureMethods from './childFixtures/types/FixtureMethods';
import WorkerMessenger from '../src/WorkerMessenger';
import { isAck2Message, isEnvelope, isAck1Message } from '../src/guards';

describe('connection management', () => {
  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('connects to window when correct origin provided in parent', async () => {
    const iframe = createAndAddIframe(getPageFixtureUrl('general'));

    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });

    const connection = connectToChild<FixtureMethods>({
      messenger,
    });

    await connection.promise;
  });

  it('connects to window when correct origin regex provided in parent', async () => {
    const iframe = createAndAddIframe(getPageFixtureUrl('general'));

    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [/^http/],
    });

    const connection = connectToChild({
      messenger,
    });

    await connection.promise;
  });

  it('connects to worker', async () => {
    const worker = new Worker(getWorkerFixtureUrl('webWorkerGeneral'));

    const messenger = new WorkerMessenger({
      worker: worker,
    });

    const connection = connectToChild({
      messenger,
    });

    await connection.promise;
  });

  it('connects to window when matching origin provided in child', async () => {
    const iframe = createAndAddIframe(
      getPageFixtureUrl('matchingParentOrigin')
    );

    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: ['http://example.com', CHILD_SERVER],
    });

    const connection = connectToChild({
      messenger,
    });

    await connection.promise;
  });

  it('connects to window connecting when matching origin regex provided in child', async () => {
    const iframe = createAndAddIframe(
      getPageFixtureUrl('matchingParentOriginRegex')
    );

    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: ['http://example.com', CHILD_SERVER],
    });

    const connection = connectToChild({
      messenger,
    });

    await connection.promise;
  });

  it("doesn't connect to window when incorrect origin provided in parent", async () => {
    const iframe = createAndAddIframe(getPageFixtureUrl('general'));

    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: ['http://example.com'],
    });

    const connection = connectToChild({
      messenger,
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it("doesn't connect to window when mismatched origin provided in child", async () => {
    const iframe = createAndAddIframe(
      getPageFixtureUrl('mismatchedParentOrigin')
    );

    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });

    const connection = connectToChild({
      messenger,
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it("doesn't connect to window when mismatched parent origin regex provided in child", async () => {
    const iframe = createAndAddIframe(
      getPageFixtureUrl('mismatchedParentOrigin')
    );

    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });

    const connection = connectToChild({
      messenger,
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it('connects to window when child redirects to different origin and origin is set to * in parent', async () => {
    const redirectToUrl = encodeURIComponent(
      getPageFixtureUrl('general', CHILD_SERVER_ALTERNATE)
    );
    const iframe = createAndAddIframe(
      getPageFixtureUrl('redirect') + `?to=${redirectToUrl}`
    );

    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: ['*'],
    });

    const connection = connectToChild({
      messenger,
    });

    await connection.promise;
  });

  it('connects to window when parent and child are on the same origin and origin is not set in parent or child', async () => {
    const iframe = createAndAddIframe('/pages/noParentOrigin.html');

    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
    });

    const connection = connectToChild({
      messenger,
    });

    await connection.promise;
  });

  it("doesn't connect to window when child redirects to different origin and origin is not set in parent", async () => {
    const redirectToUrl = encodeURIComponent(
      getPageFixtureUrl('general', CHILD_SERVER_ALTERNATE)
    );
    const iframe = createAndAddIframe(
      getPageFixtureUrl('redirect') + `?to=${redirectToUrl}`
    );

    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
    });

    const connection = connectToChild({
      messenger,
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it("doesn't connect to window when child redirects to different origin and origin is set to a mismatched origin in parent", async () => {
    const redirectToUrl = encodeURIComponent(
      getPageFixtureUrl('general', CHILD_SERVER_ALTERNATE)
    );
    const iframe = createAndAddIframe(
      getPageFixtureUrl('redirect') + `?to=${redirectToUrl}`
    );

    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });

    const connection = connectToChild({
      messenger,
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it("doesn't connect to window when child redirects to different origin and origin is set to a mismatched origin regex in parent", async () => {
    const redirectToUrl = encodeURIComponent(
      getPageFixtureUrl('general', CHILD_SERVER_ALTERNATE)
    );
    const iframe = createAndAddIframe(
      getPageFixtureUrl('redirect') + `?to=${redirectToUrl}`
    );

    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [/example\.com/],
    });

    const connection = connectToChild({
      messenger,
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it("doesn't connect to window when no origin set in child", async () => {
    const iframe = createAndAddIframe(getPageFixtureUrl('noParentOrigin'));

    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });

    const connection = connectToChild({
      messenger,
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it('reconnects after child reloads', async () => {
    const iframe = createAndAddIframe(getPageFixtureUrl('general'));

    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });

    const connection = connectToChild<FixtureMethods>({
      messenger,
    });

    const child = await connection.promise;

    return new Promise<void>((resolve) => {
      const handleMessage = async (event: MessageEvent) => {
        if (
          event.source === iframe.contentWindow &&
          isEnvelope(event.data) &&
          (isAck1Message(event.data.message) ||
            isAck2Message(event.data.message))
        ) {
          window.removeEventListener('message', handleMessage);
          child.multiply(2, 4).then((value: number) => {
            expect(value).toEqual(8);
            connection.close();
            resolve();
          });
        }
      };

      window.addEventListener('message', handleMessage);
      child.reload();
    });
  });

  it('reconnects after child navigates to other page with different methods', async () => {
    const iframe = createAndAddIframe(getPageFixtureUrl('general'));

    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });

    const connection = connectToChild<FixtureMethods>({
      messenger,
    });

    const child = await connection.promise;

    return new Promise<void>((resolve, reject) => {
      const handleMessage = async (event: MessageEvent) => {
        if (
          event.source === iframe.contentWindow &&
          isEnvelope(event.data) &&
          (isAck1Message(event.data.message) ||
            isAck2Message(event.data.message))
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
            expect((error as PenpalError).code).toEqual(
              ErrorCode.MethodNotFound
            );
            resolve();
          }
        }
      };

      window.addEventListener('message', handleMessage);
      child.navigate('/pages/methodNotInGeneralPage.html');
    });
  });

  it('rejects promise if connectToChild times out', async () => {
    const iframe = createAndAddIframe(`${CHILD_SERVER}/never-respond`);

    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });

    const connection = connectToChild<FixtureMethods>({
      messenger,
      timeout: 0,
    });

    let error;
    try {
      await connection.promise;
    } catch (e) {
      error = e;
    }
    expect(error).toEqual(jasmine.any(Error));
    expect((error as Error).message).toBe('Connection timed out after 0ms');
    expect((error as PenpalError).code).toBe(ErrorCode.ConnectionTimeout);
  });

  it(
    "doesn't close connection if connection succeeds then " +
      'timeout passes in parent',
    async () => {
      jasmine.clock().install();

      const iframe = createAndAddIframe(getPageFixtureUrl('general'));

      const messenger = new WindowMessenger({
        remoteWindow: iframe.contentWindow!,
        allowedOrigins: [CHILD_SERVER],
      });

      const connection = connectToChild<FixtureMethods>({
        messenger,
      });

      await connection.promise;
      jasmine.clock().tick(10000);

      expect(iframe.parentNode).not.toBeNull();

      connection.close();
    }
  );

  it(
    "doesn't close connection if connection succeeds then " +
      'timeout passes in child',
    (done) => {
      const iframe = createAndAddIframe(getPageFixtureUrl('timeout'));

      const messenger = new WindowMessenger({
        remoteWindow: iframe.contentWindow!,
        allowedOrigins: [CHILD_SERVER],
      });

      const connection = connectToChild<FixtureMethods>({
        messenger,
        methods: {
          reportStillConnected() {
            connection.close();
            done();
          },
        },
      });
    }
  );

  it('connects to window in parallel with separate channels', async () => {
    const iframe = createAndAddIframe(getPageFixtureUrl('channels'));

    const channelAMessenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
      channel: 'A',
    });

    // We try to connect and make method calls on both
    // children as simultaneous as possible to make the test more robust by
    // trying to trip up the logic in our code.

    const channelAConnection = connectToChild<FixtureMethods>({
      messenger: channelAMessenger,
      methods: {
        getChannel() {
          return 'A';
        },
      },
    });

    const channelBMessenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
      channel: 'B',
    });

    const channelBConnection = connectToChild<FixtureMethods>({
      messenger: channelBMessenger,
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

    const results = await Promise.all([
      channelAChild.getChannel(),
      channelBChild.getChannel(),
      channelAChild.getChannelFromParent(),
      channelBChild.getChannelFromParent(),
    ]);

    expect(results).toEqual(['A', 'B', 'A', 'B']);

    channelAConnection.close();
    channelBConnection.close();
  });

  it('connects to worker in parallel with separate channels', async () => {
    const worker = new Worker(getWorkerFixtureUrl('webWorkerChannels'));

    const channelAMessenger = new WorkerMessenger({
      worker,
      channel: 'A',
    });

    // We try to connect and make method calls on both
    // children as simultaneous as possible to make the test more robust by
    // trying to trip up the logic in our code.

    const channelAConnection = connectToChild<FixtureMethods>({
      messenger: channelAMessenger,
      methods: {
        getChannel() {
          return 'A';
        },
      },
    });

    const channelBMessenger = new WorkerMessenger({
      worker,
      channel: 'B',
    });

    const channelBConnection = connectToChild<FixtureMethods>({
      messenger: channelBMessenger,
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

    const results = await Promise.all([
      channelAChild.getChannel(),
      channelBChild.getChannel(),
      channelAChild.getChannelFromParent(),
      channelBChild.getChannelFromParent(),
    ]);

    expect(results).toEqual(['A', 'B', 'A', 'B']);

    channelAConnection.close();
    channelBConnection.close();
  });

  const invalidOrigins = [
    'localhost',
    'null',
    'http://:8080',
    '://example.com',
  ];

  for (const invalidOrigin of invalidOrigins) {
    // This test is only valid when setting an invalid parent origin when
    // calling connectToParent and not when setting an invalid child origin
    // when calling connectToChild. To understand why, it's important to
    // consider that it is the underlying postMessage call that throws the error
    // stating that the origin is invalid. The child is the first to call
    // postMessage when it sends the SYN handshake message. If the child were
    // to use a valid parent origin, the parent would receive the SYN call,
    // but the parent would see that the event.origin doesn't match the
    // configured (invalid) child origin and just ignore the message.
    // It wouldn't _fail_ the connection in this case, because it must consider
    // that the SYN message could legitimately be intended for a different
    // penpal connection. The parent would also never call postMessage in this
    // case, because it's still waiting to receive a valid SYN message. Because
    // postMessage would never be called by the parent, nothing would cause the
    // parent's connection to be rejected unless there's a connection timeout
    // configured and the timeout were reached.
    it(`rejects connection in child window when invalid origin of ${invalidOrigin} is used`, async () => {
      const iframe = createAndAddIframe(
        getPageFixtureUrl('invalidParentOrigin') +
          `?invalidParentOrigin=${invalidOrigin}`
      );

      const messenger = new WindowMessenger({
        remoteWindow: iframe.contentWindow!,
        allowedOrigins: [CHILD_SERVER],
      });

      const connection = connectToChild<FixtureMethods>({
        messenger,
      });

      const childConnectionAssertionPromise = new Promise<void>((resolve) => {
        window.addEventListener('message', (message) => {
          if (message.data.errorCode) {
            expect(message.data.errorCode).toBe(ErrorCode.TransmissionFailed);
            resolve();
          }
        });
      });

      const parentConnectionAssertionPromise = expectNeverFulfilledIframeConnection(
        connection,
        iframe
      );

      return Promise.all([
        childConnectionAssertionPromise,
        parentConnectionAssertionPromise,
      ]);
    });
  }

  it('connects to window created with window.open()', async () => {
    const childWindow = window.open(getPageFixtureUrl('openedWindow'));

    const messenger = new WindowMessenger({
      remoteWindow: childWindow!,
      allowedOrigins: [CHILD_SERVER],
    });

    const connection = connectToChild({
      messenger,
    });

    await connection.promise;

    childWindow?.close();
  });

  it('connects to shared worker', async () => {
    const worker = new SharedWorker(getWorkerFixtureUrl('sharedWorker'));

    const messenger = new PortMessenger({
      port: worker.port,
    });

    const connection = connectToChild({
      messenger,
    });

    await connection.promise;

    connection.close();
  });

  it('connects to service worker', (done) => {
    const initPenpal = async () => {
      const { port1, port2 } = new MessageChannel();

      const messenger = new PortMessenger({
        port: port1,
      });

      const connection = connectToChild<FixtureMethods>({
        messenger,
      });

      navigator.serviceWorker.controller?.postMessage(
        {
          type: 'INIT_PAYPAL',
          port: port2,
        },
        {
          transfer: [port2],
        }
      );

      await connection.promise;
      done();
    };

    if (navigator.serviceWorker.controller) {
      initPenpal();
    }

    navigator.serviceWorker.addEventListener('controllerchange', initPenpal);
    // This specific path is very important. Due to browser security, the
    // service worker file must be loaded from the root directory in order for
    // the service worker to be able to control the page the tests are
    // running in. Learn more by looking up "service worker scope".
    navigator.serviceWorker.register('/serviceWorker.js');
  });
});
