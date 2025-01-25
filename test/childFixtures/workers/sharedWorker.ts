import { connectToParent, PortMessenger } from '../../../src/index';

console.log('worker origin', self.origin);

const context = (self as unknown) as SharedWorkerGlobalScope;

context.addEventListener('connect', async (event: MessageEvent) => {
  const [port] = event.ports;

  const messenger = new PortMessenger({
    port,
  });

  const connection = connectToParent({
    messenger,
  });

  await connection.promise;
});
