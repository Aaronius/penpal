importScripts('/penpal.js');
importScripts('/shared/generalMethods.js');

console.log('worker origin', self.origin);

self.addEventListener('connect', (event) => {
  const [port] = event.ports;
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
});
