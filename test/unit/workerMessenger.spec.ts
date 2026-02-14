import { describe, expect, it, vi } from 'vitest';
import WorkerMessenger from '../../src/messengers/WorkerMessenger.js';
import PenpalError from '../../src/PenpalError.js';
import namespace from '../../src/namespace.js';
import type { Message } from '../../src/types.js';

type WorkerMessageListener = (event: MessageEvent) => void;

class FakeWorker {
  #listener?: WorkerMessageListener;
  readonly postMessage = vi.fn();

  addEventListener = (_eventType: string, listener: WorkerMessageListener) => {
    this.#listener = listener;
  };

  removeEventListener = vi.fn();

  emit = (event: MessageEvent) => {
    this.#listener?.(event);
  };
}

const validateReceivedMessage = (data: unknown): data is Message => {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Message).namespace === namespace
  );
};

describe('WorkerMessenger', () => {
  it('keeps port disconnected when ACK2 has no MessagePort', () => {
    const worker = new FakeWorker();
    const messenger = new WorkerMessenger({
      worker,
    });

    messenger.initialize({
      validateReceivedMessage,
    });

    worker.emit({
      data: {
        namespace,
        channel: undefined,
        type: 'ACK2',
      },
      ports: [],
    } as MessageEvent);

    expect(() => {
      messenger.sendMessage({
        namespace,
        channel: undefined,
        type: 'DESTROY',
      });
    }).toThrowError(PenpalError);

    try {
      messenger.sendMessage({
        namespace,
        channel: undefined,
        type: 'DESTROY',
      });
    } catch (error) {
      expect((error as PenpalError).code).toBe('TRANSMISSION_FAILED');
    }

    messenger.destroy();
  });

  it('sends over MessagePort after ACK2 contains a port', async () => {
    const worker = new FakeWorker();
    const messenger = new WorkerMessenger({
      worker,
    });

    messenger.initialize({
      validateReceivedMessage,
    });

    const { port1, port2 } = new MessageChannel();

    const messageReceived = new Promise<Message>((resolve) => {
      port1.addEventListener('message', ({ data }) => {
        resolve(data as Message);
      });
      port1.start();
    });

    worker.emit({
      data: {
        namespace,
        channel: undefined,
        type: 'ACK2',
      },
      ports: [port2],
    } as MessageEvent);

    messenger.sendMessage({
      namespace,
      channel: undefined,
      type: 'DESTROY',
    });

    await expect(messageReceived).resolves.toMatchObject({
      type: 'DESTROY',
      namespace,
    });

    messenger.destroy();
  });
});
