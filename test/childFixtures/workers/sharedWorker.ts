import { connectToParent, PortMessenger } from '../../../src/index';

declare const self: SharedWorkerGlobalScope;

console.log('worker origin', self.origin);

self.addEventListener('connect', async (event) => {
  const [port] = event.ports;

  const messenger = new PortMessenger({
    port,
  });

  const connection = connectToParent({
    messenger,
  });

  await connection.promise;
});
