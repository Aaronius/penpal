import { CHILD_SERVER, CHILD_SERVER_ALTERNATE } from '../constants.js';
import { createAndAddIframe } from '../utils.js';
import { connect, PenpalError, WindowMessenger } from '../../src/index.js';
import FixtureMethods from '../childFixtures/types/FixtureMethods.js';
import { isDeprecatedMessage } from '../../src/backwardCompatibility.js';

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

describe('BACKWARD COMPATIBILITY: connection management', () => {
  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('connects to iframe when correct child origin provided', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
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
      allowedOrigins: [/^http/],
    });
    const connection = connect<FixtureMethods>({
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
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
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
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
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
      allowedOrigins: ['http://bogus.com'],
    });
    const connection = connect<FixtureMethods>({
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
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
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
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
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
      allowedOrigins: ['*'],
    });
    const connection = connect({
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
    const connection = connect<FixtureMethods>({
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
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
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
      allowedOrigins: [/example\.com/],
    });
    const connection = connect<FixtureMethods>({
      messenger,
    });

    await expectNoSuccessfulConnection(connection.promise, iframe);
  });

  it('reconnects after child reloads', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
      messenger,
    });

    const child = await connection.promise;

    return new Promise<void>((resolve) => {
      const handleMessage = async (event: MessageEvent) => {
        if (
          event.source === iframe.contentWindow &&
          event.data?.penpal === 'ack'
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

  it('reconnects after child navigates to other page with different methods', async () => {
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
      messenger,
    });

    const child = await connection.promise;

    return new Promise<void>((resolve, reject) => {
      const handleMessage = async (event: MessageEvent) => {
        if (
          event.source === iframe.contentWindow &&
          isDeprecatedMessage(event.data) &&
          event.data.penpal === 'ack'
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
          } catch (_) {
            resolve();
          }
        }
      };

      window.addEventListener('message', handleMessage);
      child.navigate(
        '/pages/backwardCompatibility/methodNotInGeneralPage.html'
      );
    });
  });

  it('rejects promise if connection timeout passes', async () => {
    const iframe = createAndAddIframe(`${CHILD_SERVER}/never-respond`);
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
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
    expect((error as PenpalError).code).toBe('CONNECTION_TIMEOUT');
  });

  it("doesn't destroy connection if connection succeeds then timeout passes", async () => {
    jasmine.clock().install();
    const iframe = createAndAddIframe(
      `${CHILD_SERVER}/pages/backwardCompatibility/general.html`
    );
    const messenger = new WindowMessenger({
      remoteWindow: iframe.contentWindow!,
      allowedOrigins: [CHILD_SERVER],
    });
    const connection = connect<FixtureMethods>({
      messenger,
      timeout: 100000,
    });

    await connection.promise;
    jasmine.clock().tick(10000);

    expect(iframe.parentNode).not.toBeNull();

    connection.destroy();
  });
});
