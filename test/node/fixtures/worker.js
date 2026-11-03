import { createRequire } from 'node:module';
import { parentPort, workerData, MessageChannel } from 'node:worker_threads';

const { PortMessenger, Reply, connect } =
  workerData.format === 'cjs'
    ? createRequire(import.meta.url)('penpal')
    : await import('penpal');

for (const channel of workerData.channels ?? [undefined]) {
  const connection = connect({
    messenger: new PortMessenger({ port: parentPort }),
    channel,
    methods: {
      identify() {
        return channel;
      },
      multiply(left, right) {
        return left * right;
      },
      async callParent(left, right) {
        const remote = await connection.promise;
        return remote.add(left, right);
      },
      fail() {
        throw new TypeError('Worker method failed');
      },
      async failAsync() {
        throw new RangeError('Async worker method failed');
      },
      bufferLength(buffer) {
        return buffer.byteLength;
      },
      createBuffer() {
        const buffer = new Uint8Array([1, 2, 3]).buffer;
        return new Reply(buffer, { transferables: [buffer] });
      },
      async readPort(port) {
        try {
          return await new Promise((resolve) => port.once('message', resolve));
        } finally {
          port.close();
        }
      },
      createPort() {
        const { port1, port2 } = new MessageChannel();
        port1.once('message', (value) => {
          port1.postMessage(value);
          port1.close();
        });
        return new Reply(port2, { transferables: [port2] });
      },
      neverResolve() {
        return new Promise(() => {
          // Intentionally leave the call pending until the connection closes.
        });
      },
      disconnect() {
        // Let this method's reply reach the parent before disconnecting.
        setTimeout(() => connection.destroy(), 0);
      },
    },
  });
}
