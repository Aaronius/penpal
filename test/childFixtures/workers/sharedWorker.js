importScripts('/penpal.js');

console.log('worker origin', self.origin);

self.addEventListener('connect', async (event) => {
  const [port] = event.ports;

  const messenger = new Penpal.PortMessenger({
    port,
  });

  const connection = Penpal.connect({
    messenger,
  });

  await connection.promise;
});
