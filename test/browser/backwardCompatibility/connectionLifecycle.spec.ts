import { CHILD_SERVER } from '../constants.js';
import type FixtureMethods from '../fixtures/types/FixtureMethods.js';
import { expectConnectionToTimeout } from '../utils.js';
import { createBackwardCompatibilityIframeAndConnection } from './utils.js';

describe('BACKWARD COMPATIBILITY: connection management lifecycle', () => {
  it('times out for non-responsive iframe targets', async () => {
    const { connection } = createBackwardCompatibilityIframeAndConnection<
      FixtureMethods
    >({
      url: `${CHILD_SERVER}/never-respond`,
      timeout: 100,
    });

    const error = await expectConnectionToTimeout(connection);
    expect(error.message).toBe('Connection timed out after 100ms');
  });

  it('keeps iframe connection alive after timeout duration elapses', async () => {
    vi.useFakeTimers();

    const { connection } = createBackwardCompatibilityIframeAndConnection<
      FixtureMethods
    >({
      timeout: 100000,
    });

    const child = await connection.promise;

    vi.advanceTimersByTime(200000);
    await expect(child.multiply(2, 4)).resolves.toBe(8);

    connection.destroy();
  });
});
