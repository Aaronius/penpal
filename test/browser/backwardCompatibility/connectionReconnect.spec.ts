import { waitForMessageFromSource } from '../asyncUtils.js';
import FixtureMethods from '../fixtures/types/FixtureMethods.js';
import { isDeprecatedMessage } from '../../../src/backwardCompatibility.js';
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
    const error = await child.multiply(2, 4).catch((caughtError) => {
      return caughtError as Error;
    });

    expect(error).toEqual(expect.any(Error));
    expect(error.name).toBe('TypeError');
    expect(error.message).toEqual(expect.any(String));
    expect(error.message.length).toBeGreaterThan(0);

    connection.destroy();
  });
});
