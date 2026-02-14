importScripts('/penpal.js');
importScripts('/shared/generalMethods.js');

console.log('worker origin', self.origin);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('message', async (event) => {
  if (event.data?.type !== 'INIT_PENPAL') {
    return;
  }

  const { port } = event.data;
  let parentReturnValue;
  let parentApiPromise;

  const messenger = new Penpal.PortMessenger({
    port,
  });

  const methods = PenpalGeneralFixtureMethods.createParentRoundTripMethods({
    getParentApi: () => parentApiPromise,
    setParentReturnValue: (value) => {
      parentReturnValue = value;
    },
    getParentReturnValue: () => {
      return parentReturnValue;
    },
  });

  parentApiPromise = Penpal.connect({
    messenger,
    methods,
  }).promise;

  await parentApiPromise;
});
