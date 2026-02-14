importScripts('/penpal.js');

console.log('worker origin', self.origin);

self.addEventListener('connect', (event) => {
  const [port] = event.ports;
  let parentAPI;
  let parentReturnValue;

  const messenger = new Penpal.PortMessenger({
    port,
  });

  Penpal.connect({
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
  }).promise.then((parent) => {
    parentAPI = parent;
  });
});
