import {
  createIframeAndConnection,
  createPortAndConnection,
  createWorkerAndConnection,
} from './utils.js';
import FixtureMethods from './fixtures/types/FixtureMethods.js';

describe('connection management: lifecycle', () => {
  const variants = [
    {
      targetName: 'iframe',
      createConnection: createIframeAndConnection,
    },
    {
      targetName: 'worker',
      createConnection: createWorkerAndConnection,
    },
    {
      targetName: 'port',
      createConnection: createPortAndConnection,
    },
  ];

  for (const variant of variants) {
    const { targetName, createConnection } = variant;

    it(`keeps ${targetName} connection alive after timeout duration elapses`, async () => {
      vi.useFakeTimers();

      const connection = createConnection<FixtureMethods>({
        timeout: 100000,
      });

      const child = await connection.promise;

      vi.advanceTimersByTime(200000);
      await expect(child.multiply(2, 4)).resolves.toBe(8);

      connection.destroy();
    });
  }
});
