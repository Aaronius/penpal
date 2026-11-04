import { CallOptions, PenpalError } from '../../../src/index.js';
import type FixtureMethods from '../fixtures/types/FixtureMethods.js';
import type { CreateConnection } from './contractUtils.js';
import { withConnection } from './contractUtils.js';

type Options = {
  suiteName: string;
  createConnection: CreateConnection<FixtureMethods>;
};

export const runMethodCallLifecycleContract = ({
  suiteName,
  createConnection,
}: Options) => {
  describe(suiteName, () => {
    it('rejects method call promise if method call timeout is reached', async () => {
      await withConnection(createConnection, async (child) => {
        const promise = child.neverResolve(
          new CallOptions({
            timeout: 0,
          }),
        );

        await expect(promise).rejects.toBeInstanceOf(PenpalError);
        await expect(promise).rejects.toMatchObject({
          code: 'METHOD_CALL_TIMEOUT',
          message: 'Method call neverResolve() timed out after 0ms',
        });
      });
    });

    it('rejects method call promise if connection is destroyed before a reply is received', async () => {
      await withConnection(createConnection, async (child, connection) => {
        const pending = child.neverResolve();

        connection.destroy();

        await expect(pending).rejects.toBeInstanceOf(PenpalError);
        await expect(pending).rejects.toMatchObject({
          code: 'CONNECTION_DESTROYED',
          message:
            'Method call neverResolve() failed due to destroyed connection',
        });
      });
    });
  });
};
