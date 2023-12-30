import { CHILD_SERVER, WORKER_URL_PATH } from './constants';
import {
  createAndAddIframe,
  createIframeAndConnection,
  createWorkerAndConnection,
} from './utils';
import {
  connectToChildIframe,
  connectToChildWorker,
  ErrorCode,
  PenpalError,
} from '../src/index';

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
  describe(`[Child Type: ${childType}] destroy`, () => {
    // Issue #51
    it('does not resolve or reject promise', async () => {
      const connection = createConnection();
      connection.destroy();

      await expectAsync(connection.promise).toBePending();
    });

    if (childType === 'iframe') {
      it('removes method listener from window', async () => {
        const addEventListenerSpy = spyOn(
          window,
          'addEventListener'
        ).and.callThrough();
        const removeEventListenerSpy = spyOn(
          window,
          'removeEventListener'
        ).and.callThrough();

        const connection = connectToChildIframe({
          iframe: createAndAddIframe(`${CHILD_SERVER}/default.html`),
        });

        // The method call message listener is set up after the connection has been established.
        await connection.promise;
        connection.destroy();

        expect(addEventListenerSpy.calls.count()).toBe(1);
        addEventListenerSpy.calls.allArgs().forEach((args) => {
          expect(removeEventListenerSpy).toHaveBeenCalledWith(...args);
        });
      });
    }

    if (childType === 'worker') {
      it('removes method listener from worker', async () => {
        const worker = new Worker(WORKER_URL_PATH);

        const addEventListenerSpy = spyOn(
          worker,
          'addEventListener'
        ).and.callThrough();
        const removeEventListenerSpy = spyOn(
          worker,
          'removeEventListener'
        ).and.callThrough();

        const connection = connectToChildWorker({
          worker,
        });

        // The method call message listener is set up after the connection has been established.
        await connection.promise;
        connection.destroy();

        expect(addEventListenerSpy.calls.count()).toBe(1);
        addEventListenerSpy.calls.allArgs().forEach((args) => {
          expect(removeEventListenerSpy).toHaveBeenCalledWith(...args);
        });
      });
    }

    it('prevents method calls from being sent', async () => {
      const connection = createConnection();

      // The method call message listener is set up after the connection has been established.

      const child = await connection.promise;
      connection.destroy();

      let error;
      try {
        // @ts-expect-error
        child.multiply();
      } catch (e) {
        error = e;
      }
      expect(error).toEqual(jasmine.any(Error));
      expect((error as Error).message).toBe(
        'Unable to send multiply() call due to destroyed connection'
      );
      expect((error as PenpalError).code).toBe(ErrorCode.ConnectionDestroyed);
    });

    it('supports multiple connections', async () => {
      const connection1 = createConnection();
      const connection2 = createConnection();

      await Promise.all([
        connection1.promise.then(async (child) => {
          // @ts-expect-error
          const value = await child.multiplyAsync(2, 5);
          expect(value).toEqual(10);
          connection1.destroy();
        }),
        connection2.promise.then(async (child) => {
          // @ts-expect-error
          const value = await child.multiplyAsync(3, 5);
          expect(value).toEqual(15);
          connection2.destroy();
        }),
      ]);
    });
  });
}
