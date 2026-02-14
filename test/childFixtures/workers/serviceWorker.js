importScripts('/penpal.js');

console.log('worker origin', self.origin);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('message', async (event) => {
  if (event.data?.type !== 'INIT_PENPAL') {
    return;
  }

  const { port } = event.data;
  let parentAPI;
  let parentReturnValue;

  const messenger = new Penpal.PortMessenger({
    port,
  });

  const connection = Penpal.connect({
    messenger,
    methods: {
      multiply(num1, num2) {
        return num1 * num2;
      },
      addUsingParent() {
        return parentAPI.add(3, 6).then((value) => {
          parentReturnValue = value;
        });
      },
      getParentReturnValue() {
        return parentReturnValue;
      },
    },
  });

  parentAPI = await connection.promise;
});
