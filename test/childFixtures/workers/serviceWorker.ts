import { connect, PortMessenger } from '../../../src/index.js';

declare const self: ServiceWorkerGlobalScope;

console.log('worker origin', self.origin);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('message', async (event) => {
  if (event.data?.type !== 'INIT_PENPAL') {
    return;
  }

  const { port } = event.data;

  const messenger = new PortMessenger({
    port,
  });

  const connection = connect({
    messenger,
  });

  await connection.promise;
});
