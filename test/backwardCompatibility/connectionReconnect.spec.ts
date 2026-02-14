import { waitForMessageFromSource } from '../asyncUtils.js';
import FixtureMethods from '../childFixtures/types/FixtureMethods.js';
import { isDeprecatedMessage } from '../../src/backwardCompatibility.js';
import { createBackwardCompatibilityIframeAndConnection } from './utils.js';

describe('BACKWARD COMPATIBILITY: connection management reconnect', () => {
  it('reconnects after child reloads', async () => {
    const {
      iframe,
      connection,
    } = createBackwardCompatibilityIframeAndConnection<FixtureMethods>();

    const child = await connection.promise;

    const ackPromise = waitForMessageFromSource({
      source: iframe.contentWindow!,
      predicate: (event) => {
        return event.data?.penpal === 'ack';
      },
      timeoutMessage:
        'Timed out waiting for backward-compatibility handshake ACK after reload',
    });

    void child.reload();
    await ackPromise;

    await expect(child.multiply(2, 4)).resolves.toBe(8);
    connection.destroy();
  });

  it('reconnects after child navigates to other page with different methods', async () => {
    const {
      iframe,
      connection,
    } = createBackwardCompatibilityIframeAndConnection<FixtureMethods>();

    const child = await connection.promise;

    const ackPromise = waitForMessageFromSource({
      source: iframe.contentWindow!,
      predicate: (event) => {
        return isDeprecatedMessage(event.data) && event.data.penpal === 'ack';
      },
      timeoutMessage:
        'Timed out waiting for backward-compatibility handshake ACK after navigation',
    });

    void child.navigate(
      '/pages/backwardCompatibility/methodNotInGeneralPage.html'
    );
    await ackPromise;

    await expect(child.methodNotInGeneralPage()).resolves.toBe('success');
    await expect(child.multiply(2, 4)).rejects.toEqual(expect.any(Error));

    connection.destroy();
  });
});
