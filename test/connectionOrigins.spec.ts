import { CHILD_SERVER } from './constants.js';
import { expectConnectionToTimeout } from './utils.js';
import {
  createIframeConnection,
  getRedirectPageUrl,
} from './connectionManagementHelpers.js';
import type FixtureMethods from './childFixtures/types/FixtureMethods.js';

describe('connection management: origins', () => {
  const timeout = 100;

  it('connects to window when correct origin provided in parent', async () => {
    const { connection } = createIframeConnection<FixtureMethods>();

    await connection.promise;
    connection.destroy();
  });

  it('connects to window when correct origin regex provided in parent', async () => {
    const { connection } = createIframeConnection({
      allowedOrigins: [/^http/],
    });

    await connection.promise;
    connection.destroy();
  });

  it('connects to window when matching origin provided in child', async () => {
    const { connection } = createIframeConnection({
      pageName: 'matchingParentOrigin',
      allowedOrigins: ['http://example.com', CHILD_SERVER],
    });

    await connection.promise;
    connection.destroy();
  });

  it('connects to window when matching origin regex provided in child', async () => {
    const { connection } = createIframeConnection({
      pageName: 'matchingParentOriginRegex',
      allowedOrigins: ['http://example.com', CHILD_SERVER],
    });

    await connection.promise;
    connection.destroy();
  });

  it("doesn't connect to window when incorrect origin provided in parent", async () => {
    const { connection } = createIframeConnection({
      allowedOrigins: ['http://example.com'],
      timeout,
    });

    await expectConnectionToTimeout(connection);
  });

  it("doesn't connect to window when mismatched origin provided in child", async () => {
    const { connection } = createIframeConnection({
      pageName: 'mismatchedParentOrigin',
      timeout,
    });

    await expectConnectionToTimeout(connection);
  });

  it("doesn't connect to window when mismatched parent origin regex provided in child", async () => {
    const { connection } = createIframeConnection({
      pageName: 'mismatchedParentOriginRegex',
      timeout,
    });

    await expectConnectionToTimeout(connection);
  });

  it('connects to window when child redirects to different origin and origin is set to * in parent', async () => {
    const { connection } = createIframeConnection({
      url: getRedirectPageUrl(),
      allowedOrigins: ['*'],
    });

    await connection.promise;
    connection.destroy();
  });

  it('connects to window when parent and child are on the same origin and origin is not set in parent or child', async () => {
    const { connection } = createIframeConnection({
      url: '/pages/noParentOrigin.html',
      allowedOrigins: undefined,
    });

    await connection.promise;
    connection.destroy();
  });

  it("doesn't connect to window when child redirects to different origin and origin is not set in parent", async () => {
    const { connection } = createIframeConnection({
      url: getRedirectPageUrl(),
      allowedOrigins: undefined,
      timeout,
    });

    await expectConnectionToTimeout(connection);
  });

  it("doesn't connect to window when child redirects to different origin and origin is set to a mismatched origin in parent", async () => {
    const { connection } = createIframeConnection({
      url: getRedirectPageUrl(),
      allowedOrigins: [CHILD_SERVER],
      timeout,
    });

    await expectConnectionToTimeout(connection);
  });

  it("doesn't connect to window when child redirects to different origin and origin is set to a mismatched origin regex in parent", async () => {
    const { connection } = createIframeConnection({
      url: getRedirectPageUrl(),
      allowedOrigins: [/example\.com/],
      timeout,
    });

    await expectConnectionToTimeout(connection);
  });

  it("doesn't connect to window when no origin set in child", async () => {
    const { connection } = createIframeConnection({
      pageName: 'noParentOrigin',
      allowedOrigins: [CHILD_SERVER],
      timeout,
    });

    await expectConnectionToTimeout(connection);
  });
});
