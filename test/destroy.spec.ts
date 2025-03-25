import { CHILD_SERVER } from './constants.js';
import {
  createAndAddIframe,
  createIframeAndConnection,
  createWorkerAndConnection,
  getPageFixtureUrl,
  getWorkerFixtureUrl,
} from './utils.js';
import { connect, PenpalError, WindowMessenger } from '../src/index.js';
import FixtureMethods from './childFixtures/types/FixtureMethods.js';
import WorkerMessenger from '../src/messengers/WorkerMessenger.js';

describe('parent calling destroy()', () => {
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
        connection.destroy();

        await expectAsync(connection.promise).toBePending();
      });

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
          'Method call multiply() failed due to destroyed connection'
        );
        expect((error as PenpalError).code).toBe('CONNECTION_DESTROYED');
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

      const connection = connect<FixtureMethods>({
        messenger,
      });

      // The method call message listener is set up after the connection has been established.
      await connection.promise;
      connection.destroy();

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

      const connection = connect<FixtureMethods>({
        messenger,
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
});
