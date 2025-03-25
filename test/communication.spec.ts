import {
  createIframeAndConnection,
  createWorkerAndConnection,
} from './utils.js';
import { CallOptions, PenpalError } from '../src/index.js';
import FixtureMethods from './childFixtures/types/FixtureMethods.js';

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
      const value = await child.multiplyAsync(2, 5);
      expect(value).toEqual(10);
      connection.destroy();
    });

    it('treats nested apply, call, and bind calls as Function prototype method calls', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      const resultForApply = await child.multiply.apply(child, [2, 5]);
      expect(resultForApply).toEqual(10);
      const resultForCall = await child.multiply.call(child, 2, 5);
      expect(resultForCall).toEqual(10);
      const resultForBind = await child.multiply.bind(child)(2, 5);
      expect(resultForBind).toEqual(10);
    });

    it('treats top-level apply, call, and bind calls as remote method calls', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      const resultForApply = await child.apply();
      expect(resultForApply).toEqual('apply result');
      const resultForCall = await child.call();
      expect(resultForCall).toEqual('call result');
      const resultForBind = await child.bind();
      expect(resultForBind).toEqual('bind result');
    });

    it('handles transferables', async () => {
      const numbersArray = new Int32Array(new ArrayBuffer(8));
      numbersArray[0] = 4;
      numbersArray[1] = 5;

      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;

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
      connection.destroy();
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
      connection.destroy();
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

    it('handles methods with periods in the name', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      await expectAsync(child['with.period']()).toBeResolvedTo('success');
      connection.destroy();
    });

    it('rejects method call promise if method call timeout reached', async () => {
      const connection = createConnection<FixtureMethods>();
      const child = await connection.promise;
      const promise = child.neverResolve(
        new CallOptions({
          timeout: 0,
        })
      );

      let error;
      try {
        await promise;
      } catch (e) {
        error = e;
      }

      expect(error).toEqual(jasmine.any(Error));
      expect((error as Error).message).toBe(
        'Method call neverResolve() timed out after 0ms'
      );
      expect((error as PenpalError).code).toBe('METHOD_CALL_TIMEOUT');
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
        'Method call neverResolve() failed due to destroyed connection'
      );
      expect((error! as PenpalError).code).toBe('CONNECTION_DESTROYED');
      connection.destroy();
    });
  });
}
