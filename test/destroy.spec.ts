import { CHILD_SERVER } from './constants';
import {
  createAndAddIframe,
  createIframeAndConnection,
  createWorkerAndConnection,
  getPageFixtureUrl,
  getWorkerFixtureUrl,
} from './utils';
import {
  connectToChild,
  ErrorCode,
  PenpalError,
  WindowMessenger,
} from '../src/index';
import FixtureMethods from './childFixtures/types/FixtureMethods';
import WorkerMessenger from '../src/WorkerMessenger';

describe('parent calling close()', () => {
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
    describe(`when child is ${childType}`, () => {
      // Issue #51
      it('does not resolve or reject promise', async () => {
        const connection = createConnection<FixtureMethods>();
        connection.close();

        await expectAsync(connection.promise).toBePending();
      });

      it('prevents method calls from being sent', async () => {
        const connection = createConnection<FixtureMethods>();

        // The method call message listener is set up after the connection has been established.

        const child = await connection.promise;
        connection.close();

        let error;
        try {
          child.multiply(2, 3);
        } catch (e) {
          error = e;
        }
        expect(error).toEqual(jasmine.any(Error));
        expect((error as Error).message).toBe(
          'Unable to send multiply() call due to closed connection'
        );
        expect((error as PenpalError).code).toBe(ErrorCode.ConnectionClosed);
      });

      it('supports multiple connections', async () => {
        const connection1 = createConnection<FixtureMethods>();
        const connection2 = createConnection<FixtureMethods>();

        await Promise.all([
          connection1.promise.then(async (child) => {
            const value = await child.multiplyAsync(2, 5);
            expect(value).toEqual(10);
            connection1.close();
          }),
          connection2.promise.then(async (child) => {
            const value = await child.multiplyAsync(3, 5);
            expect(value).toEqual(15);
            connection2.close();
          }),
        ]);
      });
    });

    it('removes method listener from window', async () => {
      const addEventListenerSpy = spyOn(
        window,
        'addEventListener'
      ).and.callThrough();
      const removeEventListenerSpy = spyOn(
        window,
        'removeEventListener'
      ).and.callThrough();

      const iframe = createAndAddIframe(getPageFixtureUrl('general'));

      const messenger = new WindowMessenger({
        remoteWindow: iframe.contentWindow!,
        allowedOrigins: [CHILD_SERVER],
      });

      const connection = connectToChild<FixtureMethods>({
        messenger,
      });

      // The method call message listener is set up after the connection has been established.
      await connection.promise;
      connection.close();

      expect(addEventListenerSpy.calls.count()).toBe(1);
      addEventListenerSpy.calls.allArgs().forEach((args) => {
        expect(removeEventListenerSpy).toHaveBeenCalledWith(...args);
      });
    });

    it('removes method listener from worker', async () => {
      const worker = new Worker(getWorkerFixtureUrl('webWorkerGeneral'));

      const addEventListenerSpy = spyOn(
        worker,
        'addEventListener'
      ).and.callThrough();
      const removeEventListenerSpy = spyOn(
        worker,
        'removeEventListener'
      ).and.callThrough();

      const messenger = new WorkerMessenger({
        worker,
      });

      const connection = connectToChild<FixtureMethods>({
        messenger,
      });

      // The method call message listener is set up after the connection has been established.
      await connection.promise;
      connection.close();

      expect(addEventListenerSpy.calls.count()).toBe(1);
      addEventListenerSpy.calls.allArgs().forEach((args) => {
        expect(removeEventListenerSpy).toHaveBeenCalledWith(...args);
      });
    });
  }
});
