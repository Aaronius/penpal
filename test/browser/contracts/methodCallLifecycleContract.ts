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
          })
        );

        const error = await promise.catch((caughtError) => {
          return caughtError as PenpalError;
        });

        expect(error).toEqual(expect.any(PenpalError));
        expect(error.message).toBe(
          'Method call neverResolve() timed out after 0ms'
        );
        expect(error.code).toBe('METHOD_CALL_TIMEOUT');
      });
    });

    it('rejects method call promise if connection is destroyed before a reply is received', async () => {
      await withConnection(createConnection, async (child, connection) => {
        const pending = child.neverResolve();

        connection.destroy();

        const error = await pending.catch((caughtError) => {
          return caughtError as PenpalError;
        });

        expect(error).toEqual(expect.any(PenpalError));
        expect(error.message).toBe(
          'Method call neverResolve() failed due to destroyed connection'
        );
        expect(error.code).toBe('CONNECTION_DESTROYED');
      });
    });
  });
};
