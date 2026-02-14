import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEPRECATED_PENPAL_PARTICIPANT_ID } from '../../src/backwardCompatibility.js';
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
    }
  );

  removeEventListener = vi.fn(
    (_eventType: string, listener: EventListenerOrEventListenerObject) => {
      this.#listeners.delete(listener as MessageListener);
    }
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
    const remoteWindow = ({
      postMessage: vi.fn(),
    } as unknown) as Window;

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

  it('upgrades deprecated SYN and downgrades outgoing ACK1 for deprecated peers', () => {
    const postMessage = vi.fn();
    const remoteWindow = ({
      postMessage,
    } as unknown) as Window;

    const callback = vi.fn();

    const messenger = new WindowMessenger({
      remoteWindow,
      allowedOrigins: ['*'],
    });

    messenger.initialize({
      validateReceivedMessage,
      log: vi.fn(),
    });
    messenger.addMessageHandler(callback);

    fakeWindow.dispatch({
      source: remoteWindow,
      origin: 'http://legacy.test',
      data: {
        penpal: 'syn',
      },
      ports: [],
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toMatchObject({
      namespace,
      channel: undefined,
      type: 'SYN',
      participantId: DEPRECATED_PENPAL_PARTICIPANT_ID,
    });

    messenger.sendMessage({
      namespace,
      channel: undefined,
      type: 'ACK1',
      methodPaths: [['nested', 'method']],
    });

    expect(postMessage.mock.calls[0][0]).toEqual({
      penpal: 'synAck',
      methodNames: ['nested.method'],
    });
    expect(postMessage.mock.calls[0][1]).toMatchObject({
      targetOrigin: 'http://legacy.test',
    });

    messenger.destroy();
  });

  it('ignores ACK2 without a MessagePort and keeps port disconnected', () => {
    const remoteWindow = ({
      postMessage: vi.fn(),
    } as unknown) as Window;

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
      'Ignoring ACK2 because it did not include a MessagePort'
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
    const remoteWindow = ({
      postMessage: vi.fn(),
    } as unknown) as Window;

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
});
