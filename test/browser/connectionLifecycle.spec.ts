import {
  createIframeAndConnection,
  createPortAndConnection,
  createWorkerAndConnection,
} from './utils.js';
import FixtureMethods from './fixtures/types/FixtureMethods.js';

describe('connection management: lifecycle', () => {
  const variants = [
    {
      childType: 'iframe',
      createConnection: createIframeAndConnection,
    },
    {
      childType: 'worker',
      createConnection: createWorkerAndConnection,
    },
    {
      childType: 'port',
      createConnection: createPortAndConnection,
    },
  ];

  for (const variant of variants) {
    const { childType, createConnection } = variant;

    it(`keeps ${childType} connection alive after timeout duration elapses`, async () => {
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
