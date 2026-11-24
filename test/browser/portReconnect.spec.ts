import { connect, PortMessenger } from '../../src/index.js';

describe('PortMessenger reconnect', () => {
  for (const channel of [undefined, 'reused-channel']) {
    it(`reuses established ports immediately on channel ${String(channel)}`, async ({
      onTestFinished,
    }) => {
      const { port1, port2 } = new MessageChannel();
      const connections: Pick<ReturnType<typeof connect>, 'destroy'>[] = [];
      onTestFinished(() => {
        connections.forEach((connection) => connection.destroy());
        port1.close();
        port2.close();
      });

      for (let generation = 0; generation < 3; generation++) {
        const left = connect<{ generation(): number }>({
          messenger: new PortMessenger({ port: port1 }),
          channel,
          timeout: 1000,
          methods: { generation: () => generation },
        });
        const right = connect<{ generation(): number }>({
          messenger: new PortMessenger({ port: port2 }),
          channel,
          timeout: 1000,
          methods: { generation: () => generation },
        });
        connections.push(left, right);

        const [remoteRight, remoteLeft] = await Promise.all([
          left.promise,
          right.promise,
        ]);
        await expect(remoteRight.generation()).resolves.toBe(generation);
        await expect(remoteLeft.generation()).resolves.toBe(generation);
        left.destroy();
        right.destroy();
      }
    });
  }
});
