import { CHILD_SERVER } from './constants';
import {
  createAndAddIframe,
  createIframeAndConnection,
  createWorkerAndConnection,
  getWorkerFixtureUrl,
} from './utils';
import {
  connectToChildIframe,
  connectToChildWorker,
  ErrorCode,
  PenpalError,
} from '../src/index';
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
  describe(`[Child Type: ${childType}] destroy`, () => {
    // Issue #51
    it('does not resolve or reject promise', async () => {
      const connection = createConnection<FixtureMethods>();
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

        const connection = connectToChildIframe<FixtureMethods>({
          iframe: createAndAddIframe(`${CHILD_SERVER}/pages/general.html`),
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
        const worker = new Worker(getWorkerFixtureUrl('general'));

        const addEventListenerSpy = spyOn(
          worker,
          'addEventListener'
        ).and.callThrough();
        const removeEventListenerSpy = spyOn(
          worker,
          'removeEventListener'
        ).and.callThrough();

        const connection = connectToChildWorker<FixtureMethods>({
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
      const connection = createConnection<FixtureMethods>();

      // The method call message listener is set up after the connection has been established.

      const child = await connection.promise;
      connection.destroy();

      let error;
      try {
        child.multiply(2, 3);
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
      const connection1 = createConnection<FixtureMethods>();
      const connection2 = createConnection<FixtureMethods>();

      await Promise.all([
        connection1.promise.then(async (child) => {
          const value = await child.multiplyAsync(2, 5);
          expect(value).toEqual(10);
          connection1.destroy();
        }),
        connection2.promise.then(async (child) => {
          const value = await child.multiplyAsync(3, 5);
          expect(value).toEqual(15);
          connection2.destroy();
        }),
      ]);
    });
  });
}
