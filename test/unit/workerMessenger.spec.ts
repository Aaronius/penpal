import { describe, expect, it, vi } from 'vitest';
import WorkerMessenger from '../../src/messengers/WorkerMessenger.js';
import PenpalError from '../../src/PenpalError.js';
import namespace from '../../src/namespace.js';
import type { Message } from '../../src/types.js';

type WorkerMessageListener = (event: MessageEvent) => void;
type FakeMessagePort = MessagePort & {
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

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

const createFakePort = (): FakeMessagePort =>
  ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    start: vi.fn(),
    close: vi.fn(),
  }) as unknown as FakeMessagePort;

const mockMessageChannels = (
  channels: { port1: MessagePort; port2: MessagePort }[],
) => {
  const originalMessageChannel = globalThis.MessageChannel;
  let channelIndex = 0;

  globalThis.MessageChannel = class {
    readonly port1: MessagePort;
    readonly port2: MessagePort;

    constructor() {
      const channel = channels[channelIndex++];

      if (!channel) {
        throw new Error('Unexpected MessageChannel creation');
      }

      this.port1 = channel.port1;
      this.port2 = channel.port2;
    }
  } as typeof MessageChannel;

  return () => {
    globalThis.MessageChannel = originalMessageChannel;
  };
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

  it('closes previous inbound MessagePort when ACK2 includes a replacement port', async () => {
    const worker = new FakeWorker();
    const messenger = new WorkerMessenger({
      worker,
    });

    messenger.initialize({
      validateReceivedMessage,
    });

    const { port1: firstRemotePort, port2: firstMessengerPort } =
      new MessageChannel();
    const firstCloseSpy = vi.spyOn(firstMessengerPort, 'close');

    worker.emit({
      data: {
        namespace,
        channel: undefined,
        type: 'ACK2',
      },
      ports: [firstMessengerPort],
    } as MessageEvent);

    const { port1: secondRemotePort, port2: secondMessengerPort } =
      new MessageChannel();
    const messageReceived = new Promise<Message>((resolve) => {
      secondRemotePort.addEventListener('message', ({ data }) => {
        resolve(data as Message);
      });
      secondRemotePort.start();
    });

    worker.emit({
      data: {
        namespace,
        channel: undefined,
        type: 'ACK2',
      },
      ports: [secondMessengerPort],
    } as MessageEvent);

    expect(firstCloseSpy).toHaveBeenCalledTimes(1);

    messenger.sendMessage({
      namespace,
      channel: undefined,
      type: 'DESTROY',
    });

    await expect(messageReceived).resolves.toMatchObject({
      type: 'DESTROY',
      namespace,
    });

    firstRemotePort.close();
    secondRemotePort.close();
    messenger.destroy();
  });

  it('keeps existing inbound MessagePort when ACK2 has no MessagePort', async () => {
    const worker = new FakeWorker();
    const log = vi.fn();
    const messenger = new WorkerMessenger({
      worker,
    });

    messenger.initialize({
      validateReceivedMessage,
      log,
    });

    const { port1: remotePort, port2: messengerPort } = new MessageChannel();
    const closeSpy = vi.spyOn(messengerPort, 'close');
    const messageReceived = new Promise<Message>((resolve) => {
      remotePort.addEventListener('message', ({ data }) => {
        resolve(data as Message);
      });
      remotePort.start();
    });

    worker.emit({
      data: {
        namespace,
        channel: undefined,
        type: 'ACK2',
      },
      ports: [messengerPort],
    } as MessageEvent);

    worker.emit({
      data: {
        namespace,
        channel: undefined,
        type: 'ACK2',
      },
      ports: [],
    } as MessageEvent);

    expect(closeSpy).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      'Ignoring ACK2 because it did not include a MessagePort',
    );

    messenger.sendMessage({
      namespace,
      channel: undefined,
      type: 'DESTROY',
    });

    await expect(messageReceived).resolves.toMatchObject({
      type: 'DESTROY',
      namespace,
    });

    remotePort.close();
    messenger.destroy();
  });

  it('closes previous outbound MessagePort when sending duplicate ACK2', () => {
    const firstPort = createFakePort();
    const secondPort = createFakePort();
    const restoreMessageChannel = mockMessageChannels([
      { port1: firstPort, port2: createFakePort() },
      { port1: secondPort, port2: createFakePort() },
    ]);
    const worker = new FakeWorker();
    const messenger = new WorkerMessenger({
      worker,
    });

    try {
      messenger.initialize({
        validateReceivedMessage,
      });

      messenger.sendMessage({
        namespace,
        channel: undefined,
        type: 'ACK2',
      });
      messenger.sendMessage({
        namespace,
        channel: undefined,
        type: 'ACK2',
      });

      expect(firstPort.removeEventListener).toHaveBeenCalledTimes(1);
      expect(firstPort.close).toHaveBeenCalledTimes(1);
      expect(secondPort.close).not.toHaveBeenCalled();
    } finally {
      messenger.destroy();
      restoreMessageChannel();
    }
  });
});
