import { CHILD_SERVER, CHILD_SERVER_ALTERNATE } from './constants';
import { createAndAddIframe } from './utils';
import {
  connectToChildIframe,
  connectToChildWorker,
  ErrorCode,
} from '../src/index';

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

  return new Promise((resolve) => {
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
  it('connects to iframe when correct child origin provided', async () => {
    const iframe = createAndAddIframe();

    const connection = connectToChildIframe({
      debug: true,
      iframe,
      childOrigin: CHILD_SERVER,
    });

    // We're setting src after calling connectToChildIframe to ensure
    // that we don't throw an error in such a case. src is only
    // needed when childOrigin is not passed.
    iframe.src = `${CHILD_SERVER}/default.html`;

    await connection.promise;
  });

  fit('connects to worker', async () => {
    const worker = new Worker('/base/test/childFixtures/worker.js');

    const connection = connectToChildWorker({
      debug: true,
      worker,
    });

    await connection.promise;
  });

  it('connects to iframe connecting to parent with matching origin', async () => {
    const iframe = createAndAddIframe();
    iframe.src = `${CHILD_SERVER}/matchingParentOrigin.html`;

    const connection = connectToChildIframe({
      debug: true,
      iframe,
    });

    await connection.promise;
  });

  it('connects to iframe connecting to parent with matching origin regex', async () => {
    const iframe = createAndAddIframe();
    iframe.src = `${CHILD_SERVER}/matchingParentOriginRegex.html`;

    const connection = connectToChildIframe({
      debug: true,
      iframe,
    });

    await connection.promise;
  });

  it("doesn't connect to iframe when incorrect child origin provided", async () => {
    const iframe = createAndAddIframe();

    const connection = connectToChildIframe({
      debug: true,
      iframe,
      childOrigin: 'http://bogus.com',
    });

    // We're setting src after calling connectToChildIframe to ensure
    // that we don't throw an error in such a case. src is only
    // needed when childOrigin is not passed.
    iframe.src = `${CHILD_SERVER}/default.html`;

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it("doesn't connect to iframe connecting to mismatched parent origin", async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/mismatchedParentOrigin.html`
    );

    const connection = connectToChildIframe({
      iframe,
    });

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it("doesn't connect to iframe connecting to mismatched parent origin regex", async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/mismatchedParentOriginRegex.html`
    );

    const connection = connectToChildIframe({
      iframe,
    });

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it('connects to iframe when child redirects to different origin and child origin is set to *', async () => {
    const redirectToUrl = encodeURIComponent(
      `${CHILD_SERVER_ALTERNATE}/default.html`
    );
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/redirect.html?to=${redirectToUrl}`
    );

    const connection = connectToChildIframe({
      debug: true,
      iframe,
      childOrigin: '*',
    });

    await connection.promise;
  });

  it("doesn't connect to iframe when child redirects to different origin and child origin is not set", async () => {
    const redirectToUrl = encodeURIComponent(
      `${CHILD_SERVER_ALTERNATE}/default.html`
    );
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/redirect.html?to=${redirectToUrl}`
    );

    const connection = connectToChildIframe({
      debug: true,
      iframe,
    });

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it('reconnects after child reloads', (done: DoneCallback) => {
    const connection = connectToChildIframe({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
    });

    connection.promise.then((child) => {
      const previousMultiply = child.multiply;

      const intervalId = setInterval(function () {
        // Detect reconnection
        if (child.multiply !== previousMultiply) {
          clearInterval(intervalId);
          // @ts-expect-error
          child.multiply(2, 4).then((value: number) => {
            expect(value).toEqual(8);
            connection.destroy();
            done();
          });
        }
      }, 10);

      // @ts-expect-error
      child.reload();
    });
  });

  // Issue #18
  it('properly disconnects previous call receiver upon reconnection', (done: DoneCallback) => {
    const add = jasmine.createSpy().and.callFake((num1, num2) => {
      return num1 + num2;
    });

    const connection = connectToChildIframe({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
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
          // @ts-expect-error
          child.addUsingParent().then(() => {
            expect(add.calls.count()).toEqual(1);
            connection.destroy();
            done();
          });
        }
      }, 10);

      // @ts-expect-error
      child.reload();
    });
  });

  it('reconnects after child navigates to other page with different methods', (done: DoneCallback) => {
    const connection = connectToChildIframe({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
    });

    connection.promise.then((child) => {
      const intervalId = setInterval(function () {
        // Detect reconnection
        if (child.divide) {
          clearInterval(intervalId);
          expect(child.multiply).not.toBeDefined();
          // @ts-expect-error
          child.divide(6, 3).then((value) => {
            expect(value).toEqual(2);
            connection.destroy();
            done();
          });
        }
      }, 10);

      // @ts-expect-error
      child.navigate();
    });
  });

  it('rejects promise if connectToChildIframe times out', async () => {
    const connection = connectToChildIframe({
      iframe: createAndAddIframe(
        'http://www.fakeresponse.com/api/?sleep=10000'
      ),
      timeout: 0,
    });

    let error;
    try {
      await connection.promise;
    } catch (e) {
      error = e;
    }
    expect(error).toEqual(jasmine.any(Error));
    expect(error.message).toBe('Connection timed out after 0ms');
    expect(error.code).toBe(ErrorCode.ConnectionTimeout);
  });

  it(
    "doesn't destroy connection if connection succeeds then " +
      'timeout passes (connectToChildIframe)',
    async () => {
      jasmine.clock().install();

      const iframe = createAndAddIframe(`${CHILD_SERVER}/default.html`);

      const connection = connectToChildIframe({
        iframe,
        timeout: 100000,
      });

      await connection.promise;
      jasmine.clock().tick(100001);

      expect(iframe.parentNode).not.toBeNull();

      jasmine.clock().uninstall();
      connection.destroy();
    }
  );

  it(
    "doesn't destroy connection if connection succeeds then " +
      'timeout passes (connectToParent)',
    (done: DoneCallback) => {
      const connection = connectToChildIframe({
        iframe: createAndAddIframe(`${CHILD_SERVER}/timeout.html`),
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
    const iframe = createAndAddIframe(`${CHILD_SERVER}/default.html`);

    const connection = connectToChildIframe({
      iframe,
    });

    const child = await connection.promise;
    document.body.removeChild(iframe);

    jasmine.clock().tick(61000);

    let error;
    try {
      // @ts-expect-error
      await child.multiply(2, 3);
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.code).toBe(ErrorCode.ConnectionDestroyed);

    jasmine.clock().uninstall();
    connection.destroy();
  });
});
