import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WindowMessenger from '../../src/messengers/WindowMessenger.js';
import namespace from '../../src/namespace.js';
import PenpalError from '../../src/PenpalError.js';
import type { Message } from '../../src/types.js';

type MessageListener = (event: MessageEvent) => void;
type FakeMessagePort = MessagePort & {
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

class FakeHostWindow {
  origin = 'http://parent.test';
  readonly #listeners = new Set<MessageListener>();

  addEventListener = vi.fn(
    (_eventType: string, listener: EventListenerOrEventListenerObject) => {
      this.#listeners.add(listener as MessageListener);
    },
  );

  removeEventListener = vi.fn(
    (_eventType: string, listener: EventListenerOrEventListenerObject) => {
      this.#listeners.delete(listener as MessageListener);
    },
  );

  dispatch(event: Partial<MessageEvent>) {
    for (const listener of this.#listeners) {
      listener(event as MessageEvent);
    }
  }
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

describe('WindowMessenger', () => {
  let originalWindow: unknown;
  let fakeWindow: FakeHostWindow;

  beforeEach(() => {
    originalWindow = (globalThis as { window?: unknown }).window;
    fakeWindow = new FakeHostWindow();
    (globalThis as { window: unknown }).window = fakeWindow;
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
      return;
    }

    (globalThis as { window: unknown }).window = originalWindow;
  });

  it('filters out messages from disallowed origins', () => {
    const remoteWindow = {
      postMessage: vi.fn(),
    } as unknown as Window;

    const messenger = new WindowMessenger({
      remoteWindow,
      allowedOrigins: ['http://allowed.test'],
    });

    const callback = vi.fn();

    messenger.initialize({
      validateReceivedMessage,
    });
    messenger.addMessageHandler(callback);

    fakeWindow.dispatch({
      source: remoteWindow,
      origin: 'http://blocked.test',
      data: {
        namespace,
        channel: undefined,
        type: 'SYN',
        participantId: 'abc',
      },
      ports: [],
    });

    expect(callback).not.toHaveBeenCalled();

    fakeWindow.dispatch({
      source: remoteWindow,
      origin: 'http://allowed.test',
      data: {
        namespace,
        channel: undefined,
        type: 'SYN',
        participantId: 'abc',
      },
      ports: [],
    });

    expect(callback).toHaveBeenCalledTimes(1);

    messenger.destroy();
  });

  it('ignores ACK2 without a MessagePort and keeps port disconnected', () => {
    const remoteWindow = {
      postMessage: vi.fn(),
    } as unknown as Window;

    const callback = vi.fn();
    const log = vi.fn();

    const messenger = new WindowMessenger({
      remoteWindow,
      allowedOrigins: ['*'],
    });

    messenger.initialize({
      validateReceivedMessage,
      log,
    });
    messenger.addMessageHandler(callback);

    fakeWindow.dispatch({
      source: remoteWindow,
      origin: 'http://remote.test',
      data: {
        namespace,
        channel: undefined,
        type: 'SYN',
        participantId: 'abc',
      },
      ports: [],
    });

    fakeWindow.dispatch({
      source: remoteWindow,
      origin: 'http://remote.test',
      data: {
        namespace,
        channel: undefined,
        type: 'ACK2',
      },
      ports: [],
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      'Ignoring ACK2 because it did not include a MessagePort',
    );

    try {
      messenger.sendMessage({
        namespace,
        channel: undefined,
        type: 'DESTROY',
      });

      throw new Error('Expected sendMessage to throw');
    } catch (error) {
      expect(error).toEqual(expect.any(PenpalError));
      expect((error as PenpalError).code).toBe('TRANSMISSION_FAILED');
    }

    messenger.destroy();
  });

  it('sends non-handshake messages over MessagePort after ACK2 includes a port', async () => {
    const remoteWindow = {
      postMessage: vi.fn(),
    } as unknown as Window;

    const messenger = new WindowMessenger({
      remoteWindow,
      allowedOrigins: ['*'],
    });

    messenger.initialize({
      validateReceivedMessage,
    });

    fakeWindow.dispatch({
      source: remoteWindow,
      origin: 'http://remote.test',
      data: {
        namespace,
        channel: undefined,
        type: 'SYN',
        participantId: 'abc',
      },
      ports: [],
    });

    const { port1, port2 } = new MessageChannel();

    const messagePromise = new Promise<Message>((resolve) => {
      port1.addEventListener('message', ({ data }) => {
        resolve(data as Message);
      });
      port1.start();
    });

    fakeWindow.dispatch({
      source: remoteWindow,
      origin: 'http://remote.test',
      data: {
        namespace,
        channel: undefined,
        type: 'ACK2',
      },
      ports: [port2],
    });

    messenger.sendMessage({
      namespace,
      channel: undefined,
      type: 'DESTROY',
    });

    await expect(messagePromise).resolves.toMatchObject({
      type: 'DESTROY',
      namespace,
    });

    messenger.destroy();
  });

  it('closes previous inbound MessagePort when ACK2 includes a replacement port', async () => {
    const remoteWindow = {
      postMessage: vi.fn(),
    } as unknown as Window;

    const messenger = new WindowMessenger({
      remoteWindow,
      allowedOrigins: ['*'],
    });

    messenger.initialize({
      validateReceivedMessage,
    });

    fakeWindow.dispatch({
      source: remoteWindow,
      origin: 'http://remote.test',
      data: {
        namespace,
        channel: undefined,
        type: 'SYN',
        participantId: 'abc',
      },
      ports: [],
    });

    const { port1: firstRemotePort, port2: firstMessengerPort } =
      new MessageChannel();
    const firstCloseSpy = vi.spyOn(firstMessengerPort, 'close');

    fakeWindow.dispatch({
      source: remoteWindow,
      origin: 'http://remote.test',
      data: {
        namespace,
        channel: undefined,
        type: 'ACK2',
      },
      ports: [firstMessengerPort],
    });

    const { port1: secondRemotePort, port2: secondMessengerPort } =
      new MessageChannel();
    const messagePromise = new Promise<Message>((resolve) => {
      secondRemotePort.addEventListener('message', ({ data }) => {
        resolve(data as Message);
      });
      secondRemotePort.start();
    });

    fakeWindow.dispatch({
      source: remoteWindow,
      origin: 'http://remote.test',
      data: {
        namespace,
        channel: undefined,
        type: 'ACK2',
      },
      ports: [secondMessengerPort],
    });

    expect(firstCloseSpy).toHaveBeenCalledTimes(1);

    messenger.sendMessage({
      namespace,
      channel: undefined,
      type: 'DESTROY',
    });

    await expect(messagePromise).resolves.toMatchObject({
      type: 'DESTROY',
      namespace,
    });

    firstRemotePort.close();
    secondRemotePort.close();
    messenger.destroy();
  });

  it('keeps existing inbound MessagePort when ACK2 has no MessagePort', async () => {
    const remoteWindow = {
      postMessage: vi.fn(),
    } as unknown as Window;
    const log = vi.fn();

    const messenger = new WindowMessenger({
      remoteWindow,
      allowedOrigins: ['*'],
    });

    messenger.initialize({
      validateReceivedMessage,
      log,
    });

    fakeWindow.dispatch({
      source: remoteWindow,
      origin: 'http://remote.test',
      data: {
        namespace,
        channel: undefined,
        type: 'SYN',
        participantId: 'abc',
      },
      ports: [],
    });

    const { port1: remotePort, port2: messengerPort } = new MessageChannel();
    const closeSpy = vi.spyOn(messengerPort, 'close');
    const messagePromise = new Promise<Message>((resolve) => {
      remotePort.addEventListener('message', ({ data }) => {
        resolve(data as Message);
      });
      remotePort.start();
    });

    fakeWindow.dispatch({
      source: remoteWindow,
      origin: 'http://remote.test',
      data: {
        namespace,
        channel: undefined,
        type: 'ACK2',
      },
      ports: [messengerPort],
    });

    fakeWindow.dispatch({
      source: remoteWindow,
      origin: 'http://remote.test',
      data: {
        namespace,
        channel: undefined,
        type: 'ACK2',
      },
      ports: [],
    });

    expect(closeSpy).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      'Ignoring ACK2 because it did not include a MessagePort',
    );

    messenger.sendMessage({
      namespace,
      channel: undefined,
      type: 'DESTROY',
    });

    await expect(messagePromise).resolves.toMatchObject({
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
    const remoteWindow = {
      postMessage: vi.fn(),
    } as unknown as Window;
    const messenger = new WindowMessenger({
      remoteWindow,
      allowedOrigins: ['*'],
    });

    try {
      messenger.initialize({
        validateReceivedMessage,
      });

      fakeWindow.dispatch({
        source: remoteWindow,
        origin: 'http://remote.test',
        data: {
          namespace,
          channel: undefined,
          type: 'SYN',
          participantId: 'abc',
        },
        ports: [],
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
