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
      connection.close();
    });

    it('calls nested functions on the child', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      const oneLevel = await child.nested.oneLevel('pen');
      expect(oneLevel).toEqual('pen');
      const twoLevels = await child.nested.by.twoLevels('pal');
      expect(twoLevels).toEqual('pal');
      connection.close();
    });

    it('calls an asynchronous function on the child', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      const value = await child.multiplyAsync(2, 5);
      expect(value).toEqual(10);
      connection.close();
    });

    it('methods on Function prototype (like `apply`) are sent to remote', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      // Penpal doesn't know whether the developer is trying to call an
      // `apply` method on the remote or is trying to call the built-in `apply`
      // method found on the Function prototype. Because we want to allow for
      // the case that the remote is legitimately exposing an `apply` method,
      // the Penpal proxy sends a call to the remote rather than calling the
      // built-in `apply` method. The same strategy is taken for other built-in
      // methods like `bind` and `call`.
      const value = await child.nested.apply();
      expect(value).toEqual('apply result');
      connection.close();
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
      connection.close();
    });

    it('handles a promised reply instance with a promised return value', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      const value = await child.multiplyWithPromisedReplyInstanceAndPromisedReturnValue(
        2,
        5
      );
      expect(value).toEqual(10);
      connection.close();
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
      connection.close();
    });

    it('handles promises rejected with strings', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      await expectAsync(child.getPromiseRejectedWithString()).toBeRejectedWith(
        'test error string'
      );
      connection.close();
    });

    it('handles promises rejected with objects', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      let error;
      try {
        await child.getPromiseRejectedWithObject();
      } catch (e) {
        error = e;
      }
      expect(error).toEqual({ a: 'b' });
      connection.close();
    });

    it('handles promises rejected with undefined', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      let catchCalled = false;
      let error;
      try {
        await child.getPromiseRejectedWithUndefined();
      } catch (e) {
        catchCalled = true;
        error = e;
      }
      expect(catchCalled).toBeTrue();
      expect(error).toBeUndefined();
      connection.close();
    });

    it('handles promises rejected with error instances', async () => {
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
      connection.close();
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
      connection.close();
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
      connection.close();
    });

    it('handles methods with periods in the name', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      await expectAsync(child['with.period']()).toBeResolvedTo('success');
      connection.close();
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
      connection.close();
    });

    it('rejects method call promise if connection is closed before reply is received', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;

      let error: Error;

      child.neverResolve().catch((e) => {
        error = e;
      });
      connection.close();

      // Wait for microtask queue to drain
      await Promise.resolve();

      expect(error!).toEqual(jasmine.any(Error));
      expect(error!.message).toBe(
        'Method call neverResolve() failed due to closed connection'
      );
      expect((error! as PenpalError).code).toBe(ErrorCode.ConnectionClosed);
      connection.close();
    });
  });
}
