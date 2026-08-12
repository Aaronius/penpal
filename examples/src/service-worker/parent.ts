import { PortMessenger } from 'penpal';
import { connectParent } from '../shared/protocol.js';
import { createExampleUi, runExample } from '../shared/ui.js';

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

runExample(ui, async () => {
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
  await connectParent(messenger, ui.reportResult);
  ui.setState('connected', 'Connected');
});
