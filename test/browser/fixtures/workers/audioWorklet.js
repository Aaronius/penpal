import { CallOptions, PortMessenger, connect } from '/penpal.mjs';

class PenpalProcessor extends globalThis.AudioWorkletProcessor {
  constructor() {
    super();

    const connection = connect({
      messenger: new PortMessenger({ port: this.port }),
      methods: {
        multiply(left, right) {
          return left * right;
        },
        async addUsingWindow(useTimeout) {
          const remote = await connection.promise;
          return useTimeout
            ? remote.add(2, 6, new CallOptions({ timeout: 1000 }))
            : remote.add(2, 6);
        },
        async connectWithTimeout(port) {
          const timedConnection = connect({
            messenger: new PortMessenger({ port }),
            timeout: 1000,
          });
          try {
            await timedConnection.promise;
          } finally {
            timedConnection.destroy();
          }
        },
        disconnect() {
          connection.destroy();
        },
      },
    });
  }

  process() {
    return true;
  }
}

globalThis.registerProcessor('penpal-test', PenpalProcessor);
