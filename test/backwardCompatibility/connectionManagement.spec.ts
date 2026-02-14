import { CHILD_SERVER } from '../constants.js';
import { expectNeverFulfilledIframeConnection } from '../utils.js';
import type { PenpalError } from '../../src/index.js';
import FixtureMethods from '../childFixtures/types/FixtureMethods.js';
import { isDeprecatedMessage } from '../../src/backwardCompatibility.js';
import { createBackwardCompatibilityIframeAndConnection } from './utils.js';

const getAlternateFixtureOrigin = () => {
  const url = new URL(CHILD_SERVER);
  url.hostname = url.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
  return url.origin;
};

const getRedirectToUrl = () => {
  return encodeURIComponent(
    `${getAlternateFixtureOrigin()}/pages/backwardCompatibility/general.html`
  );
};

describe('BACKWARD COMPATIBILITY: connection management', () => {
  it('connects to iframe when correct child origin provided', async () => {
    const { connection } = createBackwardCompatibilityIframeAndConnection<
      FixtureMethods
    >();

    await connection.promise;
  });

  it('connects to iframe when correct child origin regex provided', async () => {
    const { connection } = createBackwardCompatibilityIframeAndConnection<
      FixtureMethods
    >({
      allowedOrigins: [/^http/],
    });

    await connection.promise;
  });

  it('connects to iframe connecting to parent with matching origin', async () => {
    const { connection } = createBackwardCompatibilityIframeAndConnection<
      FixtureMethods
    >({
      path: 'matchingParentOrigin.html',
    });

    await connection.promise;
  });

  it('connects to iframe connecting to parent with matching origin regex', async () => {
    const { connection } = createBackwardCompatibilityIframeAndConnection<
      FixtureMethods
    >({
      path: 'matchingParentOriginRegex.html',
    });

    await connection.promise;
  });

  it("doesn't connect to iframe when incorrect child origin provided", async () => {
    const {
      iframe,
      connection,
    } = createBackwardCompatibilityIframeAndConnection<FixtureMethods>({
      allowedOrigins: ['http://bogus.com'],
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it("doesn't connect to iframe connecting to mismatched parent origin", async () => {
    const {
      iframe,
      connection,
    } = createBackwardCompatibilityIframeAndConnection<FixtureMethods>({
      path: 'mismatchedParentOrigin.html',
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it("doesn't connect to iframe connecting to mismatched parent origin regex", async () => {
    const {
      iframe,
      connection,
    } = createBackwardCompatibilityIframeAndConnection<FixtureMethods>({
      path: 'mismatchedParentOriginRegex.html',
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it('connects to iframe when child redirects to different origin and child origin is set to *', async () => {
    const redirectToUrl = getRedirectToUrl();
    const { connection } = createBackwardCompatibilityIframeAndConnection<
      FixtureMethods
    >({
      path: `redirect.html?to=${redirectToUrl}`,
      allowedOrigins: ['*'],
    });

    await connection.promise;
  });

  it("doesn't connect to iframe when child redirects to different origin and child origin is not set", async () => {
    const redirectToUrl = getRedirectToUrl();
    const {
      iframe,
      connection,
    } = createBackwardCompatibilityIframeAndConnection<FixtureMethods>({
      path: `redirect.html?to=${redirectToUrl}`,
      allowedOrigins: undefined,
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it("doesn't connect to iframe when child redirects to different origin and child origin is set to a mismatched origin", async () => {
    const redirectToUrl = getRedirectToUrl();
    const {
      iframe,
      connection,
    } = createBackwardCompatibilityIframeAndConnection<FixtureMethods>({
      path: `redirect.html?to=${redirectToUrl}`,
      allowedOrigins: [CHILD_SERVER],
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it("doesn't connect to iframe when child redirects to different origin and child origin is set to a mismatched origin regex", async () => {
    const redirectToUrl = getRedirectToUrl();
    const {
      iframe,
      connection,
    } = createBackwardCompatibilityIframeAndConnection<FixtureMethods>({
      path: `redirect.html?to=${redirectToUrl}`,
      allowedOrigins: [/example\.com/],
    });

    await expectNeverFulfilledIframeConnection(connection, iframe);
  });

  it('reconnects after child reloads', async () => {
    const {
      iframe,
      connection,
    } = createBackwardCompatibilityIframeAndConnection<FixtureMethods>();

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
    const {
      iframe,
      connection,
    } = createBackwardCompatibilityIframeAndConnection<FixtureMethods>();

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
    const { connection } = createBackwardCompatibilityIframeAndConnection<
      FixtureMethods
    >({
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
  });

  it("doesn't destroy connection if connection succeeds then timeout passes", async () => {
    vi.useFakeTimers();
    const {
      iframe,
      connection,
    } = createBackwardCompatibilityIframeAndConnection<FixtureMethods>({
      timeout: 100000,
    });

    await connection.promise;
    vi.advanceTimersByTime(10000);

    expect(iframe.parentNode).not.toBeNull();

    connection.destroy();
  });
});
