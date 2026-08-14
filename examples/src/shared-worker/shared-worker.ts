import { connect, debug, PortMessenger } from 'penpal';

type WindowMethods = {
  add: (num1: number, num2: number) => number;
};

const workerGlobal = globalThis as unknown as SharedWorkerGlobalScope;

const connectToWindow = async (port: MessagePort): Promise<void> => {
  const messenger = new PortMessenger({ port });
  const connection = connect<WindowMethods>({
    messenger,
    log: debug('shared worker'),
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

workerGlobal.addEventListener('connect', (event) => {
  const port = event.ports[0];

  if (!port) {
    return;
  }

  void connectToWindow(port).catch((error: unknown) => {
    console.error(error);
  });
});
