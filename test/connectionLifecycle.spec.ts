import { CHILD_SERVER } from './constants.js';
import { createIframeConnection } from './connectionManagementHelpers.js';
import { PenpalError } from '../src/index.js';
import FixtureMethods from './childFixtures/types/FixtureMethods.js';

describe('connection management: lifecycle', () => {
  it('rejects promise if connection timeout passes', async () => {
    const { connection } = createIframeConnection<FixtureMethods>({
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

    const { iframe, connection } = createIframeConnection<FixtureMethods>();

    await connection.promise;
    vi.advanceTimersByTime(10000);

    expect(iframe.parentNode).not.toBeNull();

    connection.destroy();
  });
});
