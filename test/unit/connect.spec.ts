import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Message } from '../../src/types.js';
import type Messenger from '../../src/messengers/Messenger.js';
import type {
  InitializeMessengerOptions,
  MessageHandler,
} from '../../src/messengers/Messenger.js';
import PenpalError from '../../src/PenpalError.js';
import namespace from '../../src/namespace.js';

const shakeHandsMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/shakeHands.js', () => ({
  default: shakeHandsMock,
}));

import connect from '../../src/connect.js';

type TestMessenger = Messenger & {
  sentMessages: Message[];
  handlers: Set<MessageHandler>;
  initializeOptions?: InitializeMessengerOptions;
  destroySpy: ReturnType<typeof vi.fn>;
  emit: (message: unknown) => void;
};

const createMessenger = (): TestMessenger => {
  const sentMessages: Message[] = [];
  const handlers = new Set<MessageHandler>();
  const destroySpy = vi.fn();

  const messenger: TestMessenger = {
    sentMessages,
    handlers,
    initializeOptions: undefined,
    destroySpy,
    initialize(options) {
      this.initializeOptions = options;
    },
    sendMessage(message) {
      sentMessages.push(message);
    },
    addMessageHandler(callback) {
      handlers.add(callback);
    },
    removeMessageHandler(callback) {
      handlers.delete(callback);
    },
    destroy() {
      destroySpy();
    },
    emit(message: unknown) {
      if (!this.initializeOptions?.validateReceivedMessage(message)) {
        return;
      }

      for (const handler of handlers) {
        handler(message);
      }
    },
  };

  return messenger;
};

describe('connect', () => {
  beforeEach(() => {
    shakeHandsMock.mockReset();
  });

  it('throws INVALID_ARGUMENT when messenger is undefined', () => {
    try {
      connect({
        messenger: (undefined as unknown) as Messenger,
      });

      throw new Error('Expected connect to throw');
    } catch (error) {
      expect(error).toEqual(expect.any(PenpalError));
      expect((error as PenpalError).code).toBe('INVALID_ARGUMENT');
    }
  });

  it('throws INVALID_ARGUMENT when messenger is re-used', async () => {
    const messenger = createMessenger();

    shakeHandsMock.mockResolvedValue({
      remoteProxy: {},
      destroy: vi.fn(),
    });

    const connection = connect({
      messenger,
    });

    await connection.promise;

    try {
      connect({ messenger });
      throw new Error('Expected connect to throw for messenger re-use');
    } catch (error) {
      expect(error).toEqual(expect.any(PenpalError));
      expect((error as PenpalError).code).toBe('INVALID_ARGUMENT');
    }

    connection.destroy();
  });

  it('sends DESTROY and tears down handlers when destroy() is called', async () => {
    const messenger = createMessenger();
    const remoteDestroy = vi.fn();

    shakeHandsMock.mockResolvedValue({
      remoteProxy: {},
      destroy: remoteDestroy,
    });

    const connection = connect({
      messenger,
      channel: 'channel-a',
    });

    await connection.promise;
    connection.destroy();

    expect(messenger.sentMessages).toContainEqual({
      namespace,
      channel: 'channel-a',
      type: 'DESTROY',
    });
    expect(remoteDestroy).toHaveBeenCalledTimes(1);
    expect(messenger.destroySpy).toHaveBeenCalledTimes(1);
  });

  it('does not send DESTROY when remote sends DESTROY first', async () => {
    const messenger = createMessenger();
    const remoteDestroy = vi.fn();

    shakeHandsMock.mockResolvedValue({
      remoteProxy: {},
      destroy: remoteDestroy,
    });

    const connection = connect({
      messenger,
      channel: 'channel-b',
    });

    await connection.promise;

    messenger.emit({
      namespace,
      channel: 'channel-b',
      type: 'DESTROY',
    });

    expect(remoteDestroy).toHaveBeenCalledTimes(1);
    expect(messenger.destroySpy).toHaveBeenCalledTimes(1);
    expect(messenger.sentMessages).toHaveLength(0);

    connection.destroy();
  });

  it('tears down connection state if handshake fails', async () => {
    const messenger = createMessenger();

    shakeHandsMock.mockRejectedValue(new Error('handshake failed'));

    const connection = connect({
      messenger,
    });

    await expect(connection.promise).rejects.toThrow('handshake failed');

    expect(messenger.sentMessages).toContainEqual({
      namespace,
      channel: undefined,
      type: 'DESTROY',
    });
    expect(messenger.destroySpy).toHaveBeenCalledTimes(1);
  });
});
