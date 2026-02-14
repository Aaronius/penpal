import { CallOptions } from '../../src/index.js';
import type {
  Methods,
  PenpalError,
  RemoteProxy,
  Connection,
} from '../../src/index.js';
import type FixtureMethods from '../childFixtures/types/FixtureMethods.js';

type CreateConnection = (options?: {
  methods?: Methods;
}) => Connection<FixtureMethods>;

type Options = {
  suiteName: string;
  createConnection: CreateConnection;
  includeAdvancedCases: boolean;
};

const withConnection = async (
  createConnection: CreateConnection,
  fn: (
    child: RemoteProxy<FixtureMethods>,
    connection: Connection<FixtureMethods>
  ) => Promise<void> | void,
  options?: {
    methods?: Methods;
  }
) => {
  const connection = createConnection(options);

  try {
    const child = await connection.promise;
    await fn(child, connection);
  } finally {
    connection.destroy();
  }
};

export const runCommunicationContract = ({
  suiteName,
  createConnection,
  includeAdvancedCases,
}: Options) => {
  describe(suiteName, () => {
    it('calls a function on the child', async () => {
      await withConnection(createConnection, async (child) => {
        await expect(child.multiply(2, 5)).resolves.toBe(10);
      });
    });

    it('calls nested functions on the child', async () => {
      await withConnection(createConnection, async (child) => {
        await expect(child.nested.oneLevel('pen')).resolves.toBe('pen');
        await expect(child.nested.by.twoLevels('pal')).resolves.toBe('pal');
      });
    });

    it('calls an asynchronous function on the child', async () => {
      await withConnection(createConnection, async (child) => {
        await expect(child.multiplyAsync(2, 5)).resolves.toBe(10);
      });
    });

    if (includeAdvancedCases) {
      it('treats nested apply, call, and bind calls as Function prototype method calls', async () => {
        await withConnection(createConnection, async (child) => {
          await expect(child.multiply.apply(child, [2, 5])).resolves.toBe(10);
          await expect(child.multiply.call(child, 2, 5)).resolves.toBe(10);
          await expect(child.multiply.bind(child)(2, 5)).resolves.toBe(10);
        });
      });

      it('treats top-level apply, call, and bind calls as remote method calls', async () => {
        await withConnection(createConnection, async (child) => {
          await expect(child.apply()).resolves.toBe('apply result');
          await expect(child.call()).resolves.toBe('call result');
          await expect(child.bind()).resolves.toBe('bind result');
        });
      });

      it('handles transferables', async () => {
        const numbersArray = new Int32Array(new ArrayBuffer(8));
        numbersArray[0] = 4;
        numbersArray[1] = 5;

        await withConnection(createConnection, async (child) => {
          const resultPromise = child.double(
            numbersArray,
            new CallOptions({
              transferables: [numbersArray.buffer],
            })
          );

          // This is undefined because the underlying array buffer should
          // have been successfully transferred to the remote and this window
          // should no longer have access to it due to native browser security.
          expect(numbersArray[0]).toBeUndefined();

          const resultArray = await resultPromise;
          expect(resultArray[0]).toBe(8);
          expect(resultArray[1]).toBe(10);
        });
      });

      it('handles a promised reply instance with a promised return value', async () => {
        await withConnection(createConnection, async (child) => {
          await expect(
            child.multiplyWithPromisedReplyInstanceAndPromisedReturnValue(2, 5)
          ).resolves.toBe(10);
        });
      });
    }

    it('calls a function on the parent', async () => {
      await withConnection(
        createConnection,
        async (child) => {
          await child.addUsingParent();
          await expect(child.getParentReturnValue()).resolves.toBe(9);
        },
        {
          methods: {
            add: (num1: number, num2: number) => {
              return num1 + num2;
            },
          },
        }
      );
    });

    it('handles promises rejected with strings', async () => {
      await withConnection(createConnection, async (child) => {
        await expect(child.getPromiseRejectedWithString()).rejects.toBe(
          'test error string'
        );
      });
    });

    it('handles promises rejected with objects', async () => {
      await withConnection(createConnection, async (child) => {
        await expect(child.getPromiseRejectedWithObject()).rejects.toEqual({
          a: 'b',
        });
      });
    });

    it('handles promises rejected with undefined', async () => {
      await withConnection(createConnection, async (child) => {
        await expect(child.getPromiseRejectedWithUndefined()).rejects.toBe(
          undefined
        );
      });
    });

    it('handles promises rejected with error instances', async () => {
      await withConnection(createConnection, async (child) => {
        const error = await child
          .getPromiseRejectedWithError()
          .catch((caughtError) => {
            return caughtError as Error;
          });

        expect(error).toEqual(expect.any(Error));
        expect(error.name).toBe('TypeError');
        expect(error.message).toBe('test error object');
        expect(error.stack).toEqual(expect.any(String));
      });
    });

    it('handles thrown errors', async () => {
      await withConnection(createConnection, async (child) => {
        const error = await child.throwError().catch((caughtError) => {
          return caughtError as Error;
        });

        expect(error).toEqual(expect.any(Error));
        expect(error.message).toBe('Oh nos!');
      });
    });

    it('handles unclonable values', async () => {
      await withConnection(createConnection, async (child) => {
        const error = await child.getUnclonableValue().catch((caughtError) => {
          return caughtError as Error;
        });

        expect(error).toEqual(expect.any(Error));
        expect(error.name).toBe('DataCloneError');
      });
    });

    if (includeAdvancedCases) {
      it('handles methods with periods in the name', async () => {
        await withConnection(createConnection, async (child) => {
          await expect(child['with.period']()).resolves.toBe('success');
        });
      });
    }

    it('rejects method call promise if method call timeout reached', async () => {
      await withConnection(createConnection, async (child) => {
        const promise = child.neverResolve(
          new CallOptions({
            timeout: 0,
          })
        );

        const error = await promise.catch((caughtError) => {
          return caughtError as PenpalError;
        });

        expect(error).toEqual(expect.any(Error));
        expect(error.message).toBe(
          'Method call neverResolve() timed out after 0ms'
        );
        expect(error.code).toBe('METHOD_CALL_TIMEOUT');
      });
    });

    it('rejects method call promise if connection is destroyed before reply is received', async () => {
      await withConnection(createConnection, async (child, connection) => {
        const pending = child.neverResolve();

        connection.destroy();

        const error = await pending.catch((caughtError) => {
          return caughtError as PenpalError;
        });

        expect(error).toEqual(expect.any(Error));
        expect(error.message).toBe(
          'Method call neverResolve() failed due to destroyed connection'
        );
        expect(error.code).toBe('CONNECTION_DESTROYED');
      });
    });
  });
};
