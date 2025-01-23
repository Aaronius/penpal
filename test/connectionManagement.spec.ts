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
  ParentToChildWindowMessenger,
  ParentToChildWorkerMessenger,
} from '../src/index';
import FixtureMethods from './childFixtures/types/FixtureMethods';

describe('connection management', () => {
  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('connects to iframe when correct child origin provided', async () => {
    const iframe = createAndAddIframe(`${CHILD_SERVER}/pages/general.html`);

    const messenger = new ParentToChildWindowMessenger({
      childWindow: () => iframe.contentWindow!,
      childOrigin: CHILD_SERVER,
    });

    const connection = connectToChild({
      messenger,
    });

    await connection.promise;
  });

  it('connects to iframe when correct child origin regex provided', async () => {
    const iframe = createAndAddIframe(`${CHILD_SERVER}/pages/general.html`);

    const messenger = new ParentToChildWindowMessenger({
      childWindow: () => iframe.contentWindow!,
      childOrigin: /^http/,
    });

    const connection = connectToChild({
      messenger,
    });

    await connection.promise;
  });

  it('connects to worker', async () => {
    const worker = new Worker(getWorkerFixtureUrl('general'));

    const messenger = new ParentToChildWorkerMessenger({
      childWorker: worker,
    });

    const connection = connectToChild({
      messenger,
    });

    await connection.promise;
  });

  it('connects to iframe connecting to parent with matching origin', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/matchingParentOrigin.html`
    );

    const messenger = new ParentToChildWindowMessenger({
      childWindow: () => iframe.contentWindow!,
      childOrigin: CHILD_SERVER,
    });

    const connection = connectToChild({
      messenger,
    });

    await connection.promise;
  });

  it('connects to iframe connecting to parent with matching origin regex', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/matchingParentOriginRegex.html`
    );

    const messenger = new ParentToChildWindowMessenger({
      childWindow: () => iframe.contentWindow!,
      childOrigin: CHILD_SERVER,
    });

    const connection = connectToChild({
      messenger,
    });

    await connection.promise;
  });

  it("doesn't connect to iframe when incorrect child origin provided", async () => {
    const iframe = createAndAddIframe(`${CHILD_SERVER}/pages/general.html`);

    const messenger = new ParentToChildWindowMessenger({
      childWindow: () => iframe.contentWindow!,
      childOrigin: 'http://bogus.com',
    });

    const connection = connectToChild({
      messenger,
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it("doesn't connect to iframe connecting to mismatched parent origin", async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/mismatchedParentOrigin.html`
    );

    const messenger = new ParentToChildWindowMessenger({
      childWindow: () => iframe.contentWindow!,
      childOrigin: CHILD_SERVER,
    });

    const connection = connectToChild({
      messenger,
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it("doesn't connect to iframe connecting to mismatched parent origin regex", async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/mismatchedParentOriginRegex.html`
    );

    const messenger = new ParentToChildWindowMessenger({
      childWindow: () => iframe.contentWindow!,
      childOrigin: CHILD_SERVER,
    });

    const connection = connectToChild({
      messenger,
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it('connects to iframe when child redirects to different origin and child origin is set to *', async () => {
    const redirectToUrl = encodeURIComponent(
      `${CHILD_SERVER_ALTERNATE}/pages/general.html`
    );
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/redirect.html?to=${redirectToUrl}`
    );

    const messenger = new ParentToChildWindowMessenger({
      childWindow: () => iframe.contentWindow!,
      childOrigin: '*',
    });

    const connection = connectToChild({
      messenger,
    });

    await connection.promise;
  });

  it("doesn't connect to iframe when child redirects to different origin and child origin is not set", async () => {
    const redirectToUrl = encodeURIComponent(
      `${CHILD_SERVER_ALTERNATE}/pages/general.html`
    );
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/redirect.html?to=${redirectToUrl}`
    );

    const messenger = new ParentToChildWindowMessenger({
      childWindow: () => iframe.contentWindow!,
    });

    const connection = connectToChild({
      messenger,
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it("doesn't connect to iframe when child redirects to different origin and child origin is set to a mismatched origin", async () => {
    const redirectToUrl = encodeURIComponent(
      `${CHILD_SERVER_ALTERNATE}/pages/general.html`
    );
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/redirect.html?to=${redirectToUrl}`
    );

    const messenger = new ParentToChildWindowMessenger({
      childWindow: () => iframe.contentWindow!,
      childOrigin: CHILD_SERVER,
    });

    const connection = connectToChild({
      messenger,
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it("doesn't connect to iframe when child redirects to different origin and child origin is set to a mismatched origin regex", async () => {
    const redirectToUrl = encodeURIComponent(
      `${CHILD_SERVER_ALTERNATE}/pages/general.html`
    );
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/redirect.html?to=${redirectToUrl}`
    );

    const messenger = new ParentToChildWindowMessenger({
      childWindow: () => iframe.contentWindow!,
      childOrigin: /example\.com/,
    });

    const connection = connectToChild({
      messenger,
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it("doesn't connect to iframe when child does not set parent origin", async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/noParentOrigin.html`
    );

    const messenger = new ParentToChildWindowMessenger({
      childWindow: () => iframe.contentWindow!,
      childOrigin: CHILD_SERVER,
    });

    const connection = connectToChild({
      messenger,
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it('reconnects after child reloads', (done) => {
    const iframe = createAndAddIframe(`${CHILD_SERVER}/pages/general.html`);

    const messenger = new ParentToChildWindowMessenger({
      childWindow: () => iframe.contentWindow!,
      childOrigin: CHILD_SERVER,
    });

    const connection = connectToChild<FixtureMethods>({
      messenger,
    });

    connection.promise.then((child) => {
      const previousMultiply = child.multiply;

      const intervalId = setInterval(function () {
        // Detect reconnection
        if (child.multiply !== previousMultiply) {
          clearInterval(intervalId);
          child.multiply(2, 4).then((value: number) => {
            expect(value).toEqual(8);
            connection.close();
            done();
          });
        }
      }, 10);

      child.reload();
    });
  });

  // Issue #18
  it('properly disconnects previous call receiver upon reconnection', (done) => {
    const add = jasmine.createSpy().and.callFake((num1, num2) => {
      return num1 + num2;
    });

    const iframe = createAndAddIframe(`${CHILD_SERVER}/pages/general.html`);

    const messenger = new ParentToChildWindowMessenger({
      childWindow: () => iframe.contentWindow!,
      childOrigin: CHILD_SERVER,
    });

    const connection = connectToChild<FixtureMethods>({
      messenger,
      methods: {
        add,
      },
    });

    connection.promise.then((child) => {
      const previousAddUsingParent = child.addUsingParent;

      const intervalId = setInterval(function () {
        // Detect reconnection
        if (child.addUsingParent !== previousAddUsingParent) {
          clearInterval(intervalId);
          child.addUsingParent().then(() => {
            expect(add.calls.count()).toEqual(1);
            connection.close();
            done();
          });
        }
      }, 10);

      child.reload();
    });
  });

  it('reconnects after child navigates to other page with different methods', (done) => {
    const iframe = createAndAddIframe(`${CHILD_SERVER}/pages/general.html`);

    const messenger = new ParentToChildWindowMessenger({
      childWindow: () => iframe.contentWindow!,
      childOrigin: CHILD_SERVER,
    });

    const connection = connectToChild<FixtureMethods>({
      messenger,
    });

    connection.promise.then((child) => {
      const intervalId = setInterval(function () {
        // Detect reconnection
        if (child.methodNotInGeneralPage) {
          clearInterval(intervalId);
          expect(child.multiply).not.toBeDefined();
          child.methodNotInGeneralPage().then((value) => {
            expect(value).toEqual('method not in the general page');
            connection.close();
            done();
          });
        }
      }, 10);

      child.navigate('/pages/methodNotInGeneralPage.html');
    });
  });

  it('rejects promise if connectToChild times out', async () => {
    const iframe = createAndAddIframe(
      'http://www.fakeresponse.com/api/?sleep=10000'
    );

    const messenger = new ParentToChildWindowMessenger({
      childWindow: () => iframe.contentWindow!,
      childOrigin: 'http://www.fakeresponse.com',
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
      'timeout passes (connectToChild)',
    async () => {
      jasmine.clock().install();

      const iframe = createAndAddIframe(`${CHILD_SERVER}/pages/general.html`);

      const messenger = new ParentToChildWindowMessenger({
        childWindow: () => iframe.contentWindow!,
        childOrigin: CHILD_SERVER,
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
      'timeout passes (connectToParent)',
    (done) => {
      const iframe = createAndAddIframe(`${CHILD_SERVER}/pages/timeout.html`);

      const messenger = new ParentToChildWindowMessenger({
        childWindow: () => iframe.contentWindow!,
        childOrigin: CHILD_SERVER,
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

  it('connects to child iframe with same channel', async () => {
    const iframe = createAndAddIframe(`${CHILD_SERVER}/pages/channels.html`);

    const channelAMessenger = new ParentToChildWindowMessenger({
      childWindow: () => iframe.contentWindow!,
      childOrigin: CHILD_SERVER,
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

    const channelBMessenger = new ParentToChildWindowMessenger({
      childWindow: () => iframe.contentWindow!,
      childOrigin: CHILD_SERVER,
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

  it('connects to worker with same channel', async () => {
    const worker = new Worker(getWorkerFixtureUrl('channels'));

    const channelAMessenger = new ParentToChildWorkerMessenger({
      childWorker: worker,
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

    const channelBMessenger = new ParentToChildWorkerMessenger({
      childWorker: worker,
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
    it(`rejects connection in child iframe when invalid childOrigin of ${invalidOrigin} is used`, async () => {
      const iframe = createAndAddIframe(
        `${CHILD_SERVER}/pages/invalidParentOrigin.html?invalidParentOrigin=${invalidOrigin}`
      );

      const messenger = new ParentToChildWindowMessenger({
        childWindow: () => iframe.contentWindow!,
        childOrigin: CHILD_SERVER,
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
    const url = getPageFixtureUrl('general');
    const childWindow = window.open(url);

    const messenger = new ParentToChildWindowMessenger({
      childWindow: childWindow!,
      childOrigin: CHILD_SERVER,
    });

    const connection = connectToChild({
      messenger,
    });

    await connection.promise;
  });
});
