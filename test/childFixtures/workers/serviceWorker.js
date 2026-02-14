importScripts('/penpal.js');

console.log('worker origin', self.origin);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('message', async (event) => {
  if (event.data?.type !== 'INIT_PENPAL') {
    return;
  }

  const { port } = event.data;

  const messenger = new Penpal.PortMessenger({
    port,
  });

  const connection = Penpal.connect({
    messenger,
  });

  await connection.promise;
});
