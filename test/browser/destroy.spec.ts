import { CHILD_SERVER } from './constants.js';
import {
  createAndAddIframe,
  createIframeAndConnection,
  createPortAndConnection,
  createWorkerAndConnection,
  expectPromiseToStayPending,
  getPageFixtureUrl,
  getWorkerFixtureUrl,
} from './utils.js';
import {
  connect,
  PenpalError,
  PortMessenger,
  WindowMessenger,
} from '../../src/index.js';
import FixtureMethods from './fixtures/types/FixtureMethods.js';
import WorkerMessenger from '../../src/messengers/WorkerMessenger.js';

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
    {
      childType: 'port',
      createConnection: createPortAndConnection,
    },
  ];

  for (const variant of variants) {
    const { childType, createConnection } = variant;
    describe(`when child is ${childType}`, () => {
      // Issue #51
      it('does not resolve or reject promise', async () => {
        const connection = createConnection<FixtureMethods>();
        connection.destroy();

        await expectPromiseToStayPending(connection.promise);
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
        expect(error).toEqual(expect.any(Error));
        expect((error as Error).message).toBe(
          'Method call multiply() failed due to destroyed connection'
        );
        expect((error as PenpalError).code).toBe('CONNECTION_DESTROYED');
      });
    });
  }

  it('removes method listener from window', async () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

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

    expect(addEventListenerSpy.mock.calls.length).toBe(1);
    addEventListenerSpy.mock.calls.forEach((args) => {
      expect(removeEventListenerSpy.mock.calls).toContainEqual(args);
    });
  });

  it('removes method listener from worker', async () => {
    const worker = new Worker(getWorkerFixtureUrl('webWorkerGeneral'));

    const addEventListenerSpy = vi.spyOn(worker, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(worker, 'removeEventListener');

    const messenger = new WorkerMessenger({
      worker,
    });

    const connection = connect<FixtureMethods>({
      messenger,
    });

    // The method call message listener is set up after the connection has been established.
    await connection.promise;
    connection.destroy();

    expect(addEventListenerSpy.mock.calls.length).toBe(1);
    addEventListenerSpy.mock.calls.forEach((args) => {
      expect(removeEventListenerSpy.mock.calls).toContainEqual(args);
    });
  });

  it('removes method listener from message port', async () => {
    const { port1, port2 } = new MessageChannel();

    const addEventListenerSpy = vi.spyOn(port1, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(port1, 'removeEventListener');

    const connection = connect<FixtureMethods>({
      messenger: new PortMessenger({
        port: port1,
      }),
    });

    const remoteConnection = connect({
      messenger: new PortMessenger({
        port: port2,
      }),
    });

    await Promise.all([connection.promise, remoteConnection.promise]);

    connection.destroy();
    remoteConnection.destroy();

    expect(addEventListenerSpy.mock.calls.length).toBeGreaterThan(0);
    addEventListenerSpy.mock.calls.forEach((args) => {
      expect(removeEventListenerSpy.mock.calls).toContainEqual(args);
    });
  });
});
