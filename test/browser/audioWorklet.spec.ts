import { page } from 'vitest/browser';
import { CallOptions, PortMessenger, connect } from '../../src/index.js';
import { getWorkerFixtureUrl } from './utils.js';

interface ProcessorMethods {
  multiply(left: number, right: number): number;
  addUsingWindow(useTimeout?: boolean): Promise<number>;
  connectWithTimeout(port: MessagePort): Promise<void>;
  disconnect(): void;
}

describe('AudioWorklet', () => {
  it('calls methods in both directions and closes the connection', async () => {
    const context = new AudioContext();
    const button = document.createElement('button');
    button.textContent = 'Start AudioWorklet';
    document.body.append(button);

    try {
      await context.audioWorklet.addModule(getWorkerFixtureUrl('audioWorklet'));
      const node = new AudioWorkletNode(context, 'penpal-test');
      node.connect(context.destination);

      const started = Promise.withResolvers<void>();
      button.addEventListener('click', () => {
        void context.resume().then(started.resolve, started.reject);
      });
      await page.getByRole('button', { name: 'Start AudioWorklet' }).click();
      await started.promise;

      const connection = connect<ProcessorMethods>({
        messenger: new PortMessenger({ port: node.port }),
        timeout: 3000,
        methods: {
          add(left: number, right: number) {
            return left + right;
          },
        },
      });

      try {
        const remote = await connection.promise;
        const options = new CallOptions({ timeout: 1000 });
        const unsupportedTimeout = {
          code: 'INVALID_ARGUMENT',
          message: 'Timeouts are unavailable in this environment',
        };
        await expect(remote.multiply(2, 6, options)).resolves.toBe(12);
        await expect(remote.addUsingWindow(false, options)).resolves.toBe(8);
        await expect(
          remote.addUsingWindow(true, options),
        ).rejects.toMatchObject(unsupportedTimeout);

        const { port1, port2 } = new MessageChannel();
        try {
          await expect(
            remote.connectWithTimeout(
              port2,
              new CallOptions({ timeout: 1000, transferables: [port2] }),
            ),
          ).rejects.toMatchObject(unsupportedTimeout);
        } finally {
          port1.close();
        }

        await expect(remote.disconnect(options)).rejects.toMatchObject({
          code: 'CONNECTION_DESTROYED',
        });
      } finally {
        connection.destroy();
      }
    } finally {
      button.remove();
      await context.close();
    }
  });
});
