import { createIframeAndConnection, createWorkerAndConnection } from './utils';
import { ErrorCode, MethodCallOptions, PenpalError } from '../src/index';
import FixtureMethods from './childFixtures/types/FixtureMethods';

const variants = [
  {
    childType: 'iframe',
    createConnection: createIframeAndConnection,
  },
  {
    childType: 'worker',
    createConnection: createWorkerAndConnection,
  },
];

for (const variant of variants) {
  const { childType, createConnection } = variant;

  describe(`communication between parent and child ${childType}`, () => {
    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('calls a function on the child', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      const value = await child.multiply(2, 5);
      expect(value).toEqual(10);
      connection.destroy();
    });

    it('calls nested functions on the child', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      const oneLevel = await child.nested.oneLevel('pen');
      expect(oneLevel).toEqual('pen');
      const twoLevels = await child.nested.by.twoLevels('pal');
      expect(twoLevels).toEqual('pal');
      connection.destroy();
    });

    it('calls an asynchronous function on the child', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      const value = await child.multiply(2, 5);
      expect(value).toEqual(10);
      connection.destroy();
    });

    it('handles transferables', async () => {
      const input1DataView = new DataView(new ArrayBuffer(4));
      input1DataView.setInt32(0, 2);

      const input2DataView = new DataView(new ArrayBuffer(4));
      input2DataView.setInt32(0, 5);

      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;

      const returnValuePromise = child.multiplyUsingTransferables(
        input1DataView,
        input2DataView,
        new MethodCallOptions({
          transferables: [input1DataView.buffer, input2DataView.buffer],
        })
      );

      for (const dataView of [input1DataView, input2DataView]) {
        let errorWritingToTransferredBuffer: Error;

        try {
          /*
          An error should be thrown here because the underlying array buffer should
          have been successfully transferred to the child and the parent should no
          longer have access to it due to native browser security.
           */
          dataView.setInt32(0, 1);
        } catch (error) {
          errorWritingToTransferredBuffer = error as Error;
        }

        expect(errorWritingToTransferredBuffer!).toBeDefined();
        expect(errorWritingToTransferredBuffer!.name).toBe('TypeError');
      }

      const returnValue = await returnValuePromise;
      expect(returnValue.getInt32(0)).toBe(10);
      connection.destroy();
    });

    it('handles a promised reply instance with a promised return value', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      const value = await child.multiplyWithPromisedReplyInstanceAndPromisedReturnValue(
        2,
        5
      );
      expect(value).toEqual(10);
      connection.destroy();
    });

    it('calls a function on the parent', async () => {
      const connection = createConnection<FixtureMethods>({
        methods: {
          add: (num1: number, num2: number) => {
            return num1 + num2;
          },
        },
      });
      const child = await connection.promise;
      await child.addUsingParent();
      const value = await child.getParentReturnValue();
      expect(value).toEqual(9);
      connection.destroy();
    });

    it('handles promises rejected with strings', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      await expectAsync(child.getPromiseRejectedWithString()).toBeRejectedWith(
        'test error string'
      );
      connection.destroy();
    });

    it('handles promises rejected with error objects', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      let error;
      try {
        await child.getPromiseRejectedWithError();
      } catch (e) {
        error = e;
      }
      expect(error).toEqual(jasmine.any(Error));
      expect((error as Error).name).toBe('TypeError');
      expect((error as Error).message).toBe('test error object');
      expect((error as Error).stack).toEqual(jasmine.any(String));
      connection.destroy();
    });

    it('handles promises rejected with undefined', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      await expectAsync(
        child.getPromiseRejectedWithUndefined()
      ).toBeRejectedWith(undefined);
      connection.destroy();
    });

    it('handles thrown errors', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      let error;
      try {
        await child.throwError();
      } catch (e) {
        error = e;
      }
      expect(error).toEqual(jasmine.any(Error));
      expect((error as Error).message).toBe('Oh nos!');
      connection.destroy();
    });

    it('handles unclonable values', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      let error;
      try {
        await child.getUnclonableValue();
      } catch (e) {
        error = e;
      }
      expect(error).toEqual(jasmine.any(Error));
      expect((error as Error).name).toBe('DataCloneError');
      connection.destroy();
    });

    it('rejects method call promise if method call timeout reached', async () => {
      jasmine.clock().install();
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      const promise = child.neverResolve(
        new MethodCallOptions({
          timeout: 1000,
        })
      );
      jasmine.clock().tick(999);
      await expectAsync(promise).toBePending();
      jasmine.clock().tick(1);

      let error;
      try {
        await promise;
      } catch (e) {
        error = e;
      }

      expect(error).toEqual(jasmine.any(Error));
      expect((error as Error).message).toBe(
        'Method call neverResolve() timed out after 1000ms'
      );
      expect((error as PenpalError).code).toBe(ErrorCode.MethodCallTimeout);
      connection.destroy();
    });

    it('rejects method call promise if connection is destroyed before reply is received', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;

      let error: Error;

      child.neverResolve().catch((e) => {
        error = e;
      });
      connection.destroy();

      // Wait for microtask queue to drain
      await Promise.resolve();

      expect(error!).toEqual(jasmine.any(Error));
      expect(error!.message).toBe(
        'Method call neverResolve() cannot be resolved due to destroyed connection'
      );
      expect((error! as PenpalError).code).toBe(ErrorCode.ConnectionDestroyed);
      connection.destroy();
    });
  });
}
