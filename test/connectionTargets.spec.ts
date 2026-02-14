import { CHILD_SERVER } from './constants.js';
import {
  createWorkerAndConnection,
  getPageFixtureUrl,
  getWorkerFixtureUrl,
} from './utils.js';
import { createWindowConnection } from './connectionManagementHelpers.js';
import {
  unregisterAllServiceWorkers,
  waitForServiceWorkerController,
} from './serviceWorkerTestUtils.js';
import { connect, PortMessenger } from '../src/index.js';
import type { RemoteProxy } from '../src/index.js';
import FixtureMethods from './childFixtures/types/FixtureMethods.js';

const createParentMethods = () => {
  return {
    add(num1: number, num2: number) {
      return num1 + num2;
    },
  };
};

const assertRoundTrip = async (child: RemoteProxy<FixtureMethods>) => {
  await expect(child.multiply(3, 2)).resolves.toBe(6);
  await child.addUsingParent();
  await expect(child.getParentReturnValue()).resolves.toBe(9);
};

describe('connection management: targets', () => {
  afterEach(async () => {
    await unregisterAllServiceWorkers();
  });

  it('connects to worker', async () => {
    const connection = createWorkerAndConnection({
      workerName: 'webWorkerGeneral',
    });

    await connection.promise;
    connection.destroy();
  });

  it('connects to window created with window.open()', async () => {
    const childWindow = window.open(getPageFixtureUrl('openedWindow'));

    try {
      const connection = createWindowConnection({
        remoteWindow: childWindow!,
        allowedOrigins: [CHILD_SERVER],
      });

      await connection.promise;
      connection.destroy();
    } finally {
      childWindow?.close();
    }
  });

  it('connects to shared worker', async () => {
    const worker = new SharedWorker(getWorkerFixtureUrl('sharedWorker'));

    const connection = connect<FixtureMethods>({
      messenger: new PortMessenger({
        port: worker.port,
      }),
      methods: createParentMethods(),
    });

    const child = await connection.promise;
    await assertRoundTrip(child);

    connection.destroy();
  });

  it('connects to service worker', async () => {
    // This specific path is very important. Due to browser security, the
    // service worker file must be loaded from the root directory in order for
    // the service worker to be able to control the page the tests are
    // running in. Learn more by looking up "service worker scope".
    await navigator.serviceWorker.register('/serviceWorker.js');
    await waitForServiceWorkerController();

    const { port1, port2 } = new MessageChannel();
    const controller = navigator.serviceWorker.controller;

    expect(controller).toBeDefined();

    controller!.postMessage(
      {
        type: 'INIT_PENPAL',
        port: port2,
      },
      {
        transfer: [port2],
      }
    );

    const connection = connect<FixtureMethods>({
      messenger: new PortMessenger({
        port: port1,
      }),
      methods: createParentMethods(),
    });

    const child = await connection.promise;
    await assertRoundTrip(child);

    connection.destroy();
  });
});
