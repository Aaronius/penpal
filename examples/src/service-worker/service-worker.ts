import { PortMessenger } from 'penpal';
import { connectRemote } from '../shared/protocol.js';

const workerGlobal = globalThis as unknown as ServiceWorkerGlobalScope;

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

  const messenger = new PortMessenger({ port });
  void connectRemote(messenger);
});
