import { CHILD_SERVER, CHILD_SERVER_ALTERNATE } from './constants';
import { createAndAddIframe, getWorkerFixtureUrl } from './utils';
import { connectToChild, ErrorCode, PenpalError } from '../src/index';
import { CHECK_IFRAME_IN_DOC_INTERVAL } from '../src/parent/monitorIframeRemoval';
import FixtureMethods from './childFixtures/types/FixtureMethods';

/**
 * Asserts that no connection is successfully made between the parent and the
 * child.
 */
const expectNoSuccessfulConnection = (
  connectionPromise: Promise<unknown>,
  iframe: HTMLIFrameElement
) => {
  const spy = jasmine.createSpy();

  connectionPromise.then(spy);

  return new Promise<void>((resolve) => {
    iframe.addEventListener('load', function () {
      // Give Penpal time to try to make a handshake.
      setTimeout(() => {
        expect(spy).not.toHaveBeenCalled();
        resolve();
      }, 100);
    });
  });
};

describe('connection management', () => {
  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('connects to iframe when no child origin is provided but src is set on iframe', async () => {
    const iframe = createAndAddIframe(`${CHILD_SERVER}/pages/general.html`);

    const connection = connectToChild({
      child: iframe,
    });

    await connection.promise;
  });

  it('connects to iframe when correct child origin provided', async () => {
    const iframe = createAndAddIframe();

    const connection = connectToChild({
      child: iframe,
      childOrigin: CHILD_SERVER,
    });

    // We're setting src after calling connectToChild to ensure
    // that we don't throw an error in such a case. src is only
    // needed when childOrigin is not passed.
    iframe.src = `${CHILD_SERVER}/pages/general.html`;

    await connection.promise;
  });

  it('connects to iframe when correct child origin regex provided', async () => {
    const iframe = createAndAddIframe();

    const connection = connectToChild({
      child: iframe,
      childOrigin: /^http/,
    });

    // We're setting src after calling connectToChild to ensure
    // that we don't throw an error in such a case. src is only
    // needed when childOrigin is not passed.
    iframe.src = `${CHILD_SERVER}/pages/general.html`;

    await connection.promise;
  });

  it('connects to worker', async () => {
    const worker = new Worker(getWorkerFixtureUrl('general'));

    const connection = connectToChild({
      child: worker,
    });

    await connection.promise;
  });

  it('connects to iframe connecting to parent with matching origin', async () => {
    const iframe = createAndAddIframe();
    iframe.src = `${CHILD_SERVER}/pages/matchingParentOrigin.html`;

    const connection = connectToChild({
      child: iframe,
    });

    await connection.promise;
  });

  it('connects to iframe connecting to parent with matching origin regex', async () => {
    const iframe = createAndAddIframe();
    iframe.src = `${CHILD_SERVER}/pages/matchingParentOriginRegex.html`;

    const connection = connectToChild({
      child: iframe,
    });

    await connection.promise;
  });

  it("doesn't connect to iframe when incorrect child origin provided", async () => {
    const iframe = createAndAddIframe();

    const connection = connectToChild({
      child: iframe,
      childOrigin: 'http://bogus.com',
    });

    // We're setting src after calling connectToChild to ensure
    // that we don't throw an error in such a case. src is only
    // needed when childOrigin is not passed.
    iframe.src = `${CHILD_SERVER}/pages/general.html`;

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it("doesn't connect to iframe connecting to mismatched parent origin", async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/mismatchedParentOrigin.html`
    );

    const connection = connectToChild({
      child: iframe,
    });

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it("doesn't connect to iframe connecting to mismatched parent origin regex", async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/mismatchedParentOriginRegex.html`
    );

    const connection = connectToChild({
      child: iframe,
    });

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it('connects to iframe when child redirects to different origin and child origin is set to *', async () => {
    const redirectToUrl = encodeURIComponent(
      `${CHILD_SERVER_ALTERNATE}/pages/general.html`
    );
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/redirect.html?to=${redirectToUrl}`
    );

    const connection = connectToChild({
      child: iframe,
      childOrigin: '*',
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

    const connection = connectToChild({
      child: iframe,
    });

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it("doesn't connect to iframe when child redirects to different origin and child origin is set to a mismatched origin", async () => {
    const redirectToUrl = encodeURIComponent(
      `${CHILD_SERVER_ALTERNATE}/pages/general.html`
    );
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/redirect.html?to=${redirectToUrl}`
    );

    const connection = connectToChild({
      child: iframe,
      childOrigin: CHILD_SERVER,
    });

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it("doesn't connect to iframe when child redirects to different origin and child origin is set to a mismatched origin regex", async () => {
    const redirectToUrl = encodeURIComponent(
      `${CHILD_SERVER_ALTERNATE}/pages/general.html`
    );
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/redirect.html?to=${redirectToUrl}`
    );

    const connection = connectToChild({
      child: iframe,
      childOrigin: /example\.com/,
    });

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it("doesn't connect to iframe when child does not set parent origin", async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/noParentOrigin.html`
    );

    const connection = connectToChild({
      child: iframe,
    });

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it('reconnects after child reloads', (done) => {
    const connection = connectToChild<FixtureMethods>({
      child: createAndAddIframe(`${CHILD_SERVER}/pages/general.html`),
    });

    connection.promise.then((child) => {
      const previousMultiply = child.multiply;

      const intervalId = setInterval(function () {
        // Detect reconnection
        if (child.multiply !== previousMultiply) {
          clearInterval(intervalId);
          child.multiply(2, 4).then((value: number) => {
            expect(value).toEqual(8);
            connection.destroy();
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

    const connection = connectToChild<FixtureMethods>({
      child: createAndAddIframe(`${CHILD_SERVER}/pages/general.html`),
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
            connection.destroy();
            done();
          });
        }
      }, 10);

      child.reload();
    });
  });

  it('reconnects after child navigates to other page with different methods', (done) => {
    const connection = connectToChild<FixtureMethods>({
      child: createAndAddIframe(`${CHILD_SERVER}/pages/general.html`),
    });

    connection.promise.then((child) => {
      const intervalId = setInterval(function () {
        // Detect reconnection
        if (child.methodNotInGeneralPage) {
          clearInterval(intervalId);
          expect(child.multiply).not.toBeDefined();
          child.methodNotInGeneralPage().then((value) => {
            expect(value).toEqual('method not in the general page');
            connection.destroy();
            done();
          });
        }
      }, 10);

      child.navigate('/pages/methodNotInGeneralPage.html');
    });
  });

  it('throws error if childOrigin is not specified and cannot be derived from iframe src or srcdoc', async () => {
    let error;

    try {
      connectToChild<FixtureMethods>({
        child: createAndAddIframe(),
      });
    } catch (e) {
      error = e;
    }

    expect(error).toEqual(jasmine.any(Error));
    expect((error as Error).message).toBe(
      'The childOrigin option must be specified or the iframe must have src or srcdoc property defined'
    );
    expect((error as PenpalError).code).toBe(ErrorCode.OriginRequired);
  });

  it('rejects promise if connectToChild times out', async () => {
    const connection = connectToChild<FixtureMethods>({
      child: createAndAddIframe('http://www.fakeresponse.com/api/?sleep=10000'),
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
    "doesn't destroy connection if connection succeeds then " +
      'timeout passes (connectToChild)',
    async () => {
      jasmine.clock().install();

      const iframe = createAndAddIframe(`${CHILD_SERVER}/pages/general.html`);

      const connection = connectToChild<FixtureMethods>({
        child: iframe,
        timeout: 100000,
      });

      await connection.promise;
      jasmine.clock().tick(10000);

      expect(iframe.parentNode).not.toBeNull();

      connection.destroy();
    }
  );

  it(
    "doesn't destroy connection if connection succeeds then " +
      'timeout passes (connectToParent)',
    (done) => {
      const connection = connectToChild<FixtureMethods>({
        child: createAndAddIframe(`${CHILD_SERVER}/pages/timeout.html`),
        methods: {
          reportStillConnected() {
            connection.destroy();
            done();
          },
        },
      });
    }
  );

  it('destroys connection if iframe has been removed from DOM', async () => {
    jasmine.clock().install();
    const iframe = createAndAddIframe(`${CHILD_SERVER}/pages/general.html`);

    const connection = connectToChild<FixtureMethods>({
      child: iframe,
    });

    const child = await connection.promise;
    document.body.removeChild(iframe);

    jasmine.clock().tick(CHECK_IFRAME_IN_DOC_INTERVAL);

    let error;
    try {
      await child.multiply(2, 3);
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect((error as PenpalError).code).toBe(ErrorCode.ConnectionDestroyed);

    connection.destroy();
  });

  it('connects to child iframe with same channel', async () => {
    const iframe = createAndAddIframe(`${CHILD_SERVER}/pages/channels.html`);

    // We try to connect and make method calls on both
    // children as simultaneous as possible to make the test more robust by
    // trying to trip up the logic in our code.

    const channelAConnection = connectToChild<FixtureMethods>({
      child: iframe,
      channel: 'A',
      methods: {
        getChannel() {
          return 'A';
        },
      },
    });

    const channelBConnection = connectToChild<FixtureMethods>({
      child: iframe,
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

    const results = await Promise.all([
      channelAChild.getChannel(),
      channelBChild.getChannel(),
      channelAChild.getChannelFromParent(),
      channelBChild.getChannelFromParent(),
    ]);

    expect(results).toEqual(['A', 'B', 'A', 'B']);

    channelAConnection.destroy();
    channelBConnection.destroy();
  });

  it('connects to worker with same channel', async () => {
    const worker = new Worker(getWorkerFixtureUrl('channels'));

    // We try to connect and make method calls on both
    // children as simultaneous as possible to make the test more robust by
    // trying to trip up the logic in our code.

    const channelAConnection = connectToChild<FixtureMethods>({
      child: worker,
      channel: 'A',
      methods: {
        getChannel() {
          return 'A';
        },
      },
    });

    const channelBConnection = connectToChild<FixtureMethods>({
      child: worker,
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

    const results = await Promise.all([
      channelAChild.getChannel(),
      channelBChild.getChannel(),
      channelAChild.getChannelFromParent(),
      channelBChild.getChannelFromParent(),
    ]);

    expect(results).toEqual(['A', 'B', 'A', 'B']);

    channelAConnection.destroy();
    channelBConnection.destroy();
  });
});
