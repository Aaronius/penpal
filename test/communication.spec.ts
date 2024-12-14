import { createIframeAndConnection, createWorkerAndConnection } from './utils';
import { MessageOptions } from '../src/index';

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
    it('calls a function on the child', async () => {
      const connection = createConnection();
      const child = await connection.promise;
      // @ts-expect-error
      const value = await child.multiply(2, 5);
      expect(value).toEqual(10);
      connection.destroy();
    });

    it('calls nested functions on the child', async () => {
      const connection = createConnection();
      const child = await connection.promise;
      // @ts-expect-error
      const oneLevel = await child.nested.oneLevel('pen');
      expect(oneLevel).toEqual('pen');
      // @ts-expect-error
      const twoLevels = await child.nested.by.twoLevels('pal');
      expect(twoLevels).toEqual('pal');
      connection.destroy();
    });

    it('calls an asynchronous function on the child', async () => {
      const connection = createConnection();
      const child = await connection.promise;
      // @ts-expect-error
      const value = await child.multiply(2, 5);
      expect(value).toEqual(10);
      connection.destroy();
    });

    it('calls a function on the child using transferables', async () => {
      const input1DataView = new DataView(new ArrayBuffer(4));
      input1DataView.setInt32(0, 2);

      const input2DataView = new DataView(new ArrayBuffer(4));
      input2DataView.setInt32(0, 5);

      const connection = createConnection();
      const child = await connection.promise;

      // @ts-expect-error
      const returnValuePromise = child.multiplyUsingTransferables(
        input1DataView,
        input2DataView,
        new MessageOptions({
          transfer: [input1DataView.buffer, input2DataView.buffer],
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
          input1DataView.setInt32(0, 1);
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

    it('calls a function on the child using transferables', async () => {
      const input1DataView = new DataView(new ArrayBuffer(4));
      input1DataView.setInt32(0, 2);

      const input2DataView = new DataView(new ArrayBuffer(4));
      input2DataView.setInt32(0, 5);

      const connection = createConnection();
      const child = await connection.promise;

      // @ts-expect-error
      const returnValuePromise = child.multiplyUsingTransferables(
        input1DataView,
        input2DataView,
        new MessageOptions({
          transfer: [input1DataView.buffer, input2DataView.buffer],
        })
      );

      // Validate that data views were actually transferred (not clones) to child
      for (const dataView of [input1DataView, input2DataView]) {
        let errorWritingToTransferredBuffer: Error;

        try {
          /*
          An error should be thrown here because once the browser transfers
          the data view array buffers to the child, the browser will block
          access to the buffers from the parent.
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

    it('calls a function on the parent', async () => {
      const connection = createConnection({
        methods: {
          add: (num1: number, num2: number) => {
            return num1 + num2;
          },
        },
      });
      const child = await connection.promise;
      // @ts-expect-error
      await child.addUsingParent();
      // @ts-expect-error
      const value = await child.getParentReturnValue();
      expect(value).toEqual(9);
      connection.destroy();
    });

    it('handles promises rejected with strings', async () => {
      const connection = createConnection();
      const child = await connection.promise;
      // @ts-expect-error
      await expectAsync(child.getRejectedPromiseString()).toBeRejectedWith(
        'test error string'
      );
      connection.destroy();
    });

    it('handles promises rejected with error objects', async () => {
      const connection = createConnection();
      const child = await connection.promise;
      let error;
      try {
        // @ts-expect-error
        await child.getRejectedPromiseError();
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
      const connection = createConnection();
      const child = await connection.promise;
      let error;
      try {
        // @ts-expect-error
        await child.throwError();
      } catch (e) {
        error = e;
      }
      expect(error).toEqual(jasmine.any(Error));
      expect((error as Error).message).toBe('Oh nos!');
      connection.destroy();
    });

    it('handles unclonable values', async () => {
      const connection = createConnection();
      const child = await connection.promise;
      let error;
      try {
        // @ts-expect-error
        await child.getUnclonableValue();
      } catch (e) {
        error = e;
      }
      expect(error).toEqual(jasmine.any(Error));
      expect((error as Error).name).toBe('DataCloneError');
      connection.destroy();
    });
  });
}
