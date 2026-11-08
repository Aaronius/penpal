import { CallOptions, PortMessenger, connect } from '../../src/index.js';
import { withTimeout } from './asyncUtils.js';
import { getWorkerFixtureUrl } from './utils.js';

interface ProcessorMethods {
  multiply(left: number, right: number): number;
  addUsingWindow(useTimeout?: boolean): Promise<number>;
  connectWithTimeout(port: MessagePort): Promise<void>;
  disconnect(): void;
}

describe('AudioWorklet', () => {
  it('calls methods in both directions and closes the connection', async () => {
    // The test only needs the processor's message port. An offline context
    // can create the processor without starting audio playback in CI.
    const context = new OfflineAudioContext(1, 128, 48000);
    await withTimeout(
      context.audioWorklet.addModule(getWorkerFixtureUrl('audioWorklet')),
      5000,
      'Timed out loading the AudioWorklet processor',
    );
    const node = new AudioWorkletNode(context, 'penpal-test');

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
      await expect(remote.addUsingWindow(true, options)).rejects.toMatchObject(
        unsupportedTimeout,
      );

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
  });
});
