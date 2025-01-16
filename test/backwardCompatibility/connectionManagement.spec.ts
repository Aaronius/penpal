import { CHILD_SERVER, CHILD_SERVER_ALTERNATE } from '../constants';
import { createAndAddIframe } from '../utils';
import { connectToChild, ErrorCode, PenpalError } from '../../src/index';
import { CHECK_IFRAME_IN_DOC_INTERVAL } from '../../src/parent/monitorIframeRemoval';
import FixtureMethods from '../childFixtures/types/FixtureMethods';

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

describe('backward compatibility - connection management', () => {
  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('connects to iframe when no child origin is provided but src is set on iframe', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );

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
    iframe.src = `${CHILD_SERVER}/pages/backwardCompatibility/general.html`;

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
    iframe.src = `${CHILD_SERVER}/pages/backwardCompatibility/general.html`;

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
    iframe.src = `${CHILD_SERVER}/pages/backwardCompatibility/general.html`;

    await connection.promise;
  });

  it('connects to iframe connecting to parent with matching origin', async () => {
    const iframe = createAndAddIframe();
    iframe.src = `${CHILD_SERVER}/pages/backwardCompatibility/matchingParentOrigin.html`;

    const connection = connectToChild({
      child: iframe,
    });

    await connection.promise;
  });

  it('connects to iframe connecting to parent with matching origin regex', async () => {
    const iframe = createAndAddIframe();
    iframe.src = `${CHILD_SERVER}/pages/backwardCompatibility/matchingParentOriginRegex.html`;

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
    iframe.src = `${CHILD_SERVER}/pages/backwardCompatibility/general.html`;

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it("doesn't connect to iframe connecting to mismatched parent origin", async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/mismatchedParentOrigin.html`
    );

    const connection = connectToChild({
      child: iframe,
    });

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it("doesn't connect to iframe connecting to mismatched parent origin regex", async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/mismatchedParentOriginRegex.html`
    );

    const connection = connectToChild({
      child: iframe,
    });

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it('connects to iframe when child redirects to different origin and child origin is set to *', async () => {
    const redirectToUrl = encodeURIComponent(
      `${CHILD_SERVER_ALTERNATE}/pages/backwardCompatibility/general.html`
    );
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/redirect.html?to=${redirectToUrl}`
    );

    const connection = connectToChild({
      child: iframe,
      childOrigin: '*',
    });

    await connection.promise;
  });

  it("doesn't connect to iframe when child redirects to different origin and child origin is not set", async () => {
    const redirectToUrl = encodeURIComponent(
      `${CHILD_SERVER_ALTERNATE}/pages/backwardCompatibility/general.html`
    );
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/redirect.html?to=${redirectToUrl}`
    );

    const connection = connectToChild({
      child: iframe,
    });

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it("doesn't connect to iframe when child redirects to different origin and child origin is set to a mismatched origin", async () => {
    const redirectToUrl = encodeURIComponent(
      `${CHILD_SERVER_ALTERNATE}/pages/backwardCompatibility/general.html`
    );
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/redirect.html?to=${redirectToUrl}`
    );

    const connection = connectToChild({
      child: iframe,
      childOrigin: CHILD_SERVER,
    });

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it("doesn't connect to iframe when child redirects to different origin and child origin is set to a mismatched origin regex", async () => {
    const redirectToUrl = encodeURIComponent(
      `${CHILD_SERVER_ALTERNATE}/pages/backwardCompatibility/general.html`
    );
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/redirect.html?to=${redirectToUrl}`
    );

    const connection = connectToChild({
      child: iframe,
      childOrigin: /example\.com/,
    });

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it('reconnects after child reloads', (done) => {
    const connection = connectToChild<FixtureMethods>({
      child: createAndAddIframe(
        `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
      ),
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
      child: createAndAddIframe(
        `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
      ),
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
      child: createAndAddIframe(
        `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
      ),
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

      child.navigate(
        '/pages/backwardCompatibility/methodNotInGeneralPage.html'
      );
    });
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

      const iframe = createAndAddIframe(
        `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
      );

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
        child: createAndAddIframe(
          `${CHILD_SERVER}/pages/backwardCompatibility/timeout.html`
        ),
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
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );

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
});
