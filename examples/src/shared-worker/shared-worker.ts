import { PortMessenger } from 'penpal';
import { connectRemote } from '../shared/protocol.js';

const workerGlobal = globalThis as unknown as SharedWorkerGlobalScope;

workerGlobal.addEventListener('connect', (event) => {
  const port = event.ports[0];

  if (!port) {
    return;
  }

  const messenger = new PortMessenger({ port });
  void connectRemote(messenger);
});
