import { connect, debug, PortMessenger } from 'penpal';
import { createExampleUi } from '../shared/ui.js';

type ServiceWorkerMethods = {
  multiply: (num1: number, num2: number) => number;
  divide: (num1: number, num2: number) => Promise<number>;
};

const ui = createExampleUi();

const waitForController = async (): Promise<ServiceWorker> => {
  if (navigator.serviceWorker.controller) {
    return navigator.serviceWorker.controller;
  }

  return new Promise<ServiceWorker>((resolve) => {
    const handleControllerChange = () => {
      const controller = navigator.serviceWorker.controller;

      if (!controller) {
        return;
      }

      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange,
      );
      resolve(controller);
    };

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      handleControllerChange,
    );
  });
};

const run = async (): Promise<void> => {
  await navigator.serviceWorker.register(
    new URL('./service-worker.js', import.meta.url),
    {
      scope: './',
      type: 'module',
    },
  );
  const controller = await waitForController();
  const { port1, port2 } = new MessageChannel();

  controller.postMessage(
    {
      type: 'INIT_PENPAL',
      port: port2,
    },
    [port2],
  );

  const messenger = new PortMessenger({ port: port1 });
  const connection = connect<ServiceWorkerMethods>({
    messenger,
    log: debug('window'),
    methods: {
      add(num1: number, num2: number) {
        const result = num1 + num2;
        ui.reportResult('add', result);
        return result;
      },
    },
  });

  const serviceWorkerMethods = await connection.promise;
  ui.setState('connected', 'Connected');

  const multiplicationResult = await serviceWorkerMethods.multiply(2, 6);
  ui.reportResult('multiply', multiplicationResult);

  const divisionResult = await serviceWorkerMethods.divide(12, 4);
  ui.reportResult('divide', divisionResult);
};

void run().catch((error: unknown) => {
  ui.fail(error);
});
