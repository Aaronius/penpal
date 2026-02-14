import { CHILD_SERVER } from '../constants.js';
import type { PenpalError } from '../../../src/index.js';
import FixtureMethods from '../fixtures/types/FixtureMethods.js';
import { createBackwardCompatibilityIframeAndConnection } from './utils.js';

describe('BACKWARD COMPATIBILITY: connection management lifecycle', () => {
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
    connection.destroy();
  });

  it("doesn't destroy connection if connection succeeds then timeout passes", async () => {
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
