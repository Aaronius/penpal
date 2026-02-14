import { CHILD_SERVER } from '../constants.js';
import { expectNeverFulfilledIframeConnection } from '../utils.js';
import FixtureMethods from '../childFixtures/types/FixtureMethods.js';
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

describe('BACKWARD COMPATIBILITY: connection management origins', () => {
  it('connects to iframe when correct child origin provided', async () => {
    const { connection } = createBackwardCompatibilityIframeAndConnection<
      FixtureMethods
    >();

    await connection.promise;
    connection.destroy();
  });

  it('connects to iframe when correct child origin regex provided', async () => {
    const { connection } = createBackwardCompatibilityIframeAndConnection<
      FixtureMethods
    >({
      allowedOrigins: [/^http/],
    });

    await connection.promise;
    connection.destroy();
  });

  it('connects to iframe connecting to parent with matching origin', async () => {
    const { connection } = createBackwardCompatibilityIframeAndConnection<
      FixtureMethods
    >({
      path: 'matchingParentOrigin.html',
    });

    await connection.promise;
    connection.destroy();
  });

  it('connects to iframe connecting to parent with matching origin regex', async () => {
    const { connection } = createBackwardCompatibilityIframeAndConnection<
      FixtureMethods
    >({
      path: 'matchingParentOriginRegex.html',
    });

    await connection.promise;
    connection.destroy();
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
    connection.destroy();
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
});
