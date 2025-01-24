import { CHILD_SERVER, CHILD_SERVER_ALTERNATE } from '../constants';
import { createAndAddIframe } from '../utils';
import {
  connectToChild,
  ErrorCode,
  PenpalError,
  WindowMessenger,
} from '../../src/index';
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

  it('connects to iframe when correct child origin provided', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      remoteOrigin: CHILD_SERVER,
    });
    const connection = connectToChild<FixtureMethods>({
      messenger,
    });

    await connection.promise;
  });

  it('connects to iframe when correct child origin regex provided', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      remoteOrigin: /^http/,
    });
    const connection = connectToChild<FixtureMethods>({
      messenger,
    });

    await connection.promise;
  });

  it('connects to iframe connecting to parent with matching origin', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/matchingParentOrigin.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      remoteOrigin: CHILD_SERVER,
    });
    const connection = connectToChild<FixtureMethods>({
      messenger,
    });

    await connection.promise;
  });

  it('connects to iframe connecting to parent with matching origin regex', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/matchingParentOriginRegex.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      remoteOrigin: CHILD_SERVER,
    });
    const connection = connectToChild<FixtureMethods>({
      messenger,
    });

    await connection.promise;
  });

  it("doesn't connect to iframe when incorrect child origin provided", async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      remoteOrigin: 'http://bogus.com',
    });
    const connection = connectToChild<FixtureMethods>({
      messenger,
    });

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it("doesn't connect to iframe connecting to mismatched parent origin", async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/mismatchedParentOrigin.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      remoteOrigin: CHILD_SERVER,
    });
    const connection = connectToChild<FixtureMethods>({
      messenger,
    });

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it("doesn't connect to iframe connecting to mismatched parent origin regex", async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/mismatchedParentOriginRegex.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      remoteOrigin: CHILD_SERVER,
    });
    const connection = connectToChild<FixtureMethods>({
      messenger,
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
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      remoteOrigin: '*',
    });
    const connection = connectToChild({
      messenger,
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
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
    });
    const connection = connectToChild<FixtureMethods>({
      messenger,
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
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      remoteOrigin: CHILD_SERVER,
    });
    const connection = connectToChild<FixtureMethods>({
      messenger,
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
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      remoteOrigin: /example\.com/,
    });
    const connection = connectToChild<FixtureMethods>({
      messenger,
    });

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it('reconnects after child reloads', (done) => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      remoteOrigin: CHILD_SERVER,
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

    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      remoteOrigin: CHILD_SERVER,
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
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      remoteOrigin: CHILD_SERVER,
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

      child.navigate(
        '/pages/backwardCompatibility/methodNotInGeneralPage.html'
      );
    });
  });

  it('rejects promise if connectToChild times out', async () => {
    const iframe = createAndAddIframe(
      'http://www.fakeresponse.com/api/?sleep=10000'
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      remoteOrigin: CHILD_SERVER,
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
      const iframe = createAndAddIframe(
        `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
      );
      const messenger = new WindowMessenger({
        remoteWindow: iframe.contentWindow!,
        remoteOrigin: CHILD_SERVER,
      });
      const connection = connectToChild<FixtureMethods>({
        messenger,
        timeout: 100000,
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
      const iframe = createAndAddIframe(
        `${CHILD_SERVER}/pages/backwardCompatibility/timeout.html`
      );
      const messenger = new WindowMessenger({
        remoteWindow: iframe.contentWindow!,
        remoteOrigin: CHILD_SERVER,
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
});
