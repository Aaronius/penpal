import { CHILD_SERVER, CHILD_SERVER_ALTERNATE } from './constants';
import { createAndAddIframe } from './utils';

/**
 * Asserts that no connection is successfully made between the parent and the
 * child.
 */
const expectNoSuccessfulConnection = (connectionPromise, iframe) => {
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

    const connection = Penpal.connectToChild({
      debug: true,
      iframe,
      childOrigin: CHILD_SERVER,
    });

    // We're setting src after calling connectToChild to ensure
    // that we don't throw an error in such a case. src is only
    // needed when childOrigin is not passed.
    iframe.src = `${CHILD_SERVER}/default.html`;

    await connection.promise;
  });

  it('connects to iframe connecting to parent with matching origin', async () => {
    const iframe = createAndAddIframe();
    iframe.src = `${CHILD_SERVER}/matchingParentOrigin.html`;

    const connection = Penpal.connectToChild({
      debug: true,
      iframe,
    });

    await connection.promise;
  });

  it('connects to iframe connecting to parent with matching origin regex', async () => {
    const iframe = createAndAddIframe();
    iframe.src = `${CHILD_SERVER}/matchingParentOriginRegex.html`;

    const connection = Penpal.connectToChild({
      debug: true,
      iframe,
    });

    await connection.promise;
  });

  it("doesn't connect to iframe when incorrect child origin provided", async () => {
    const iframe = createAndAddIframe();

    const connection = Penpal.connectToChild({
      debug: true,
      iframe,
      childOrigin: 'http://bogus.com',
    });

    // We're setting src after calling connectToChild to ensure
    // that we don't throw an error in such a case. src is only
    // needed when childOrigin is not passed.
    iframe.src = `${CHILD_SERVER}/default.html`;

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it("doesn't connect to iframe connecting to mismatched parent origin", async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/mismatchedParentOrigin.html`
    );

    const connection = Penpal.connectToChild({
      iframe,
    });

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it("doesn't connect to iframe connecting to mismatched parent origin regex", async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/mismatchedParentOriginRegex.html`
    );

    const connection = Penpal.connectToChild({
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

    const connection = Penpal.connectToChild({
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

    const connection = Penpal.connectToChild({
      debug: true,
      iframe,
    });

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it('reconnects after child reloads', (done) => {
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
    });

    connection.promise.then((child) => {
      const previousMultiply = child.multiply;

      const intervalId = setInterval(function () {
        // Detect reconnection
        if (child.multiply !== previousMultiply) {
          clearInterval(intervalId);
          child.multiply(2, 4).then((value) => {
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

    const connection = Penpal.connectToChild({
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
    const connection = Penpal.connectToChild({
      iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
    });

    connection.promise.then((child) => {
      const intervalId = setInterval(function () {
        // Detect reconnection
        if (child.divide) {
          clearInterval(intervalId);
          expect(child.multiply).not.toBeDefined();
          child.divide(6, 3).then((value) => {
            expect(value).toEqual(2);
            connection.destroy();
            done();
          });
        }
      }, 10);

      child.navigate();
    });
  });

  it('rejects promise if connectToChild times out', async () => {
    const connection = Penpal.connectToChild({
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
    expect(error.code).toBe(Penpal.ErrorCode.ConnectionTimeout);
  });

  it(
    "doesn't destroy connection if connection succeeds then " +
      'timeout passes (connectToChild)',
    async () => {
      jasmine.clock().install();

      const iframe = createAndAddIframe(`${CHILD_SERVER}/default.html`);

      const connection = Penpal.connectToChild({
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
    (done) => {
      var connection = Penpal.connectToChild({
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

  it(
    'destroys connection if iframe has been removed from DOM ' +
      'and method is called',
    async () => {
      const iframe = createAndAddIframe(`${CHILD_SERVER}/default.html`);

      var connection = Penpal.connectToChild({
        iframe,
        appendTo: document.body,
      });

      const child = await connection.promise;
      document.body.removeChild(iframe);

      let error;
      try {
        child.multiply(2, 3);
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error.code).toBe(Penpal.ErrorCode.ConnectionDestroyed);
    }
  );

  it('calls onConnectionLost when connection with child is lost', (done) => {
    const iframe = createAndAddIframe(`${CHILD_SERVER}/default.html`);

    const connection = Penpal.connectToChild({
      iframe,
      onConnectionLost: () => {
        expect(true).toBe(true);
        done();
      },
    });

    connection.promise.then(() => {
      document.body.removeChild(iframe);
    });
  });

  it('calls onConnection when connection with child is established or re-established', (done) => {
    const iframe = createAndAddIframe(`${CHILD_SERVER}/default.html`);

    let connectionCount = 0;

    const connection = Penpal.connectToChild({
      iframe,
      onConnection: () => {
        connectionCount += 1;
        if (connectionCount === 2) {
          expect(true).toBe(true);
          connection.destroy();
          done();
        }
      },
    });

    connection.promise.then((child) => {
      child.reload();
    });
  });

  it('calls onConnectionLost when connection with parent is lost', (done) => {
    const iframe = createAndAddIframe(`${CHILD_SERVER}/default.html`);

    const connection = Penpal.connectToParent({
      iframe,
      onConnectionLost: () => {
        expect(true).toBe(true);
        done();
      },
    });

    connection.promise.then(() => {
      document.body.removeChild(iframe);
    });
  });

  it('calls onConnection when connection with parent is established or re-established', (done) => {
    const iframe = createAndAddIframe(`${CHILD_SERVER}/default.html`);

    let connectionCount = 0;

    const connection = Penpal.connectToParent({
      iframe,
      onConnection: () => {
        connectionCount += 1;
        if (connectionCount === 2) {
          expect(true).toBe(true);
          connection.destroy();
          done();
        }
      },
    });

    connection.promise.then((parent) => {
      parent.reload();
    });
  });
});
