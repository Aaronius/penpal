import { connect, PortMessenger } from 'penpal';

type WindowMethods = {
  add: (num1: number, num2: number) => number;
};

const workerGlobal = globalThis as unknown as ServiceWorkerGlobalScope;

const connectToWindow = async (port: MessagePort): Promise<void> => {
  const messenger = new PortMessenger({ port });
  const connection = connect<WindowMethods>({
    messenger,
    methods: {
      multiply(num1: number, num2: number) {
        return num1 * num2;
      },
      divide(num1: number, num2: number) {
        return new Promise<number>((resolve) => {
          setTimeout(() => {
            resolve(num1 / num2);
          }, 250);
        });
      },
    },
  });

  const windowMethods = await connection.promise;
  await windowMethods.add(2, 6);
};

workerGlobal.addEventListener('install', (event) => {
  event.waitUntil(workerGlobal.skipWaiting());
});

workerGlobal.addEventListener('activate', (event) => {
  event.waitUntil(workerGlobal.clients.claim());
});

workerGlobal.addEventListener('message', (event) => {
  if (event.data?.type !== 'INIT_PENPAL') {
    return;
  }

  const port = event.ports[0];

  if (!port) {
    return;
  }

  event.waitUntil(connectToWindow(port));
});
