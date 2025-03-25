import { connect, PortMessenger } from '../../../src/index.js';

declare const self: SharedWorkerGlobalScope;

console.log('worker origin', self.origin);

self.addEventListener('connect', async (event) => {
  const [port] = event.ports;

  const messenger = new PortMessenger({
    port,
  });

  const connection = connect({
    messenger,
  });

  await connection.promise;
});
