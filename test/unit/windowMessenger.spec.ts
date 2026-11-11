import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WindowMessenger from '../../src/messengers/WindowMessenger.js';
import namespace from '../../src/namespace.js';
import PenpalError from '../../src/PenpalError.js';
import type { Message } from '../../src/types.js';

type MessageListener = (event: MessageEvent) => void;

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
      onMessage: callback,
    });

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

  it.each([
    {
      allowedOrigin: /^http:\/\/allowed\.test$/g,
      flagName: 'global',
    },
    {
      allowedOrigin: /^http:\/\/allowed\.test$/y,
      flagName: 'sticky',
    },
  ])(
    'accepts repeated messages when the allowed origin regex uses the $flagName flag',
    ({ allowedOrigin }) => {
      const remoteWindow = {
        postMessage: vi.fn(),
      } as unknown as Window;
      const messenger = new WindowMessenger({
        remoteWindow,
        allowedOrigins: [allowedOrigin],
      });
      const callback = vi.fn();
      const message = {
        namespace,
        channel: undefined,
        type: 'SYN',
        participantId: 'abc',
      } as const;

      messenger.initialize({ validateReceivedMessage, onMessage: callback });

      fakeWindow.dispatch({
        source: remoteWindow,
        origin: 'http://allowed.test',
        data: message,
        ports: [],
      });
      fakeWindow.dispatch({
        source: remoteWindow,
        origin: 'http://allowed.test',
        data: message,
        ports: [],
      });

      expect(callback).toHaveBeenCalledTimes(2);

      messenger.destroy();
    },
  );

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
      onMessage: callback,
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
      onMessage: vi.fn(),
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

  it('closes the old port when the remote starts reconnecting', async () => {
    const remoteWindow = {
      postMessage: vi.fn(),
    } as unknown as Window;

    const messenger = new WindowMessenger({
      remoteWindow,
      allowedOrigins: ['*'],
    });

    messenger.initialize({
      validateReceivedMessage,
      onMessage: vi.fn(),
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
        type: 'SYN',
        participantId: 'def',
      },
      ports: [],
    });

    expect(firstCloseSpy).toHaveBeenCalledTimes(1);

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
      onMessage: vi.fn(),
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
});
