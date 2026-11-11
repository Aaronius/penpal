import { afterEach, describe, expect, it, vi } from 'vitest';
import type Messenger from '../../src/messengers/Messenger.js';
import PenpalError from '../../src/PenpalError.js';
import namespace from '../../src/namespace.js';
import connect from '../../src/connect.js';
import { MockMessenger } from './mockMessenger.js';

const messageBase = { namespace, channel: 'test-channel' };

// This ID sorts after any locally generated ID, so the remote leads.
const remoteSyn = {
  ...messageBase,
  type: 'SYN',
  participantId: 'remote',
} as const;

const completeHandshake = (messenger: MockMessenger) => {
  messenger.emit(remoteSyn);
  messenger.emit({ ...messageBase, type: 'ACK1' });
};

describe('connect', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws INVALID_ARGUMENT when messenger is undefined', () => {
    expect(() =>
      connect({ messenger: undefined as unknown as Messenger }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_ARGUMENT' }));
  });

  it('throws INVALID_ARGUMENT when messenger is re-used', async () => {
    const messenger = new MockMessenger();
    const connection = connect({ messenger, channel: messageBase.channel });

    completeHandshake(messenger);
    await connection.promise;

    expect(() => connect({ messenger })).toThrow(
      expect.objectContaining({ code: 'INVALID_ARGUMENT' }),
    );
    connection.destroy();
  });

  it('sends DESTROY and tears down handlers when destroy() is called', async () => {
    const messenger = new MockMessenger();
    const destroySpy = vi.spyOn(messenger, 'destroy');
    const connection = connect<{ ping(): string }>({
      messenger,
      channel: messageBase.channel,
    });

    completeHandshake(messenger);
    const remote = await connection.promise;
    const pendingCall = remote.ping();
    connection.destroy();
    connection.destroy();

    expect(messenger.sentMessages.at(-1)).toEqual({
      ...messageBase,
      type: 'DESTROY',
    });
    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(messenger.handlers.size).toBe(0);
    await expect(pendingCall).rejects.toMatchObject({
      code: 'CONNECTION_DESTROYED',
    });
  });

  it('rejects pending connection promise when destroy() is called', async () => {
    vi.useFakeTimers();
    const messenger = new MockMessenger();
    const connection = connect({
      messenger,
      channel: messageBase.channel,
      timeout: 50,
    });

    connection.destroy();

    await expect(connection.promise).rejects.toMatchObject({
      name: 'PenpalError',
      code: 'CONNECTION_DESTROYED',
      message: 'Connection destroyed',
    });
    expect(messenger.sentMessages.at(-1)).toEqual({
      ...messageBase,
      type: 'DESTROY',
    });
    expect(messenger.handlers.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not send DESTROY when remote sends DESTROY first', async () => {
    const messenger = new MockMessenger();
    const destroySpy = vi.spyOn(messenger, 'destroy');
    const connection = connect({ messenger, channel: messageBase.channel });

    completeHandshake(messenger);
    await connection.promise;

    const numberOfMessages = messenger.sentMessages.length;
    messenger.emit({ ...messageBase, type: 'DESTROY' });
    connection.destroy();

    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(messenger.handlers.size).toBe(0);
    expect(messenger.sentMessages).toHaveLength(numberOfMessages);
  });

  it('rejects pending connection promise when remote sends DESTROY first', async () => {
    const messenger = new MockMessenger();
    const connection = connect({ messenger, channel: messageBase.channel });

    messenger.emit({ ...messageBase, type: 'DESTROY' });

    await expect(connection.promise).rejects.toMatchObject({
      code: 'CONNECTION_DESTROYED',
    });
    expect(messenger.sentMessages).toEqual([
      expect.objectContaining({ type: 'SYN' }),
    ]);
    expect(messenger.handlers.size).toBe(0);
  });

  it('skips the handshake if the messenger disconnects during initialization', async () => {
    const messenger = new MockMessenger();
    messenger.initialize = ({ onDisconnect }) => {
      onDisconnect?.();
    };

    const connection = connect({ messenger });

    await expect(connection.promise).rejects.toMatchObject({
      code: 'CONNECTION_DESTROYED',
    });
    expect(messenger.handlers.size).toBe(0);
    expect(messenger.sentMessages).toHaveLength(0);
  });

  it('skips the handshake if the messenger disconnects while registering the listener', async () => {
    const messenger = new MockMessenger();
    messenger.addMessageHandler = (handler) => {
      messenger.handlers.add(handler);
      messenger.initializeOptions?.onDisconnect?.();
    };

    const connection = connect({ messenger });

    await expect(connection.promise).rejects.toMatchObject({
      code: 'CONNECTION_DESTROYED',
    });
    expect(messenger.handlers.size).toBe(0);
    expect(messenger.sentMessages).toHaveLength(0);
  });

  it('cleans up when the messenger disconnects while sending the first SYN', async () => {
    const messenger = new MockMessenger();
    messenger.sendMessageImpl = () => {
      messenger.initializeOptions?.onDisconnect?.();
    };

    const connection = connect({ messenger });

    await expect(connection.promise).rejects.toMatchObject({
      code: 'CONNECTION_DESTROYED',
    });
    expect(messenger.handlers.size).toBe(0);
    expect(messenger.sentMessages).toEqual([
      expect.objectContaining({ type: 'SYN' }),
    ]);
  });

  it('can receive handshake messages synchronously while sending the first SYN', async () => {
    const messenger = new MockMessenger();
    messenger.sendMessageImpl = () => {
      messenger.sendMessageImpl = vi.fn();
      completeHandshake(messenger);
    };

    const connection = connect({ messenger, channel: messageBase.channel });

    await expect(connection.promise).resolves.toBeDefined();
    expect(messenger.sentMessages.map(({ type }) => type)).toEqual([
      'SYN',
      'SYN',
      'ACK2',
    ]);
    connection.destroy();
  });

  it('rejects if the messenger disconnects just after the final handshake message', async () => {
    const messenger = new MockMessenger();
    const connection = connect({ messenger, channel: messageBase.channel });

    completeHandshake(messenger);
    messenger.initializeOptions?.onDisconnect?.();

    await expect(connection.promise).rejects.toMatchObject({
      code: 'CONNECTION_DESTROYED',
    });
    expect(messenger.handlers.size).toBe(0);
  });

  it.each(['SYN', 'ACK2'])(
    'tears down the connection if sending %s fails',
    async (type) => {
      const messenger = new MockMessenger();
      messenger.sendMessageImpl = (message) => {
        if (message.type === type) {
          throw new Error('send failed');
        }
      };
      const connection = connect({ messenger, channel: messageBase.channel });

      if (type === 'ACK2') {
        completeHandshake(messenger);
      }

      await expect(connection.promise).rejects.toBeInstanceOf(PenpalError);
      await expect(connection.promise).rejects.toMatchObject({
        code: 'TRANSMISSION_FAILED',
        message: 'send failed',
      });
      expect(messenger.sentMessages.at(-1)).toEqual({
        ...messageBase,
        type: 'DESTROY',
      });
      expect(messenger.handlers.size).toBe(0);
    },
  );

  it('tears down the messenger if a handshake send fails during reconnection', async () => {
    const messenger = new MockMessenger();
    const destroySpy = vi.spyOn(messenger, 'destroy');
    const connection = connect<{ ping(): string }>({
      messenger,
      channel: messageBase.channel,
    });

    completeHandshake(messenger);
    const remote = await connection.promise;
    const pendingCall = remote.ping();
    messenger.sendMessageImpl = ({ type }) => {
      if (type === 'SYN') {
        throw new Error('send failed');
      }
    };
    messenger.emit({ ...remoteSyn, participantId: 'reloaded' });

    await expect(pendingCall).rejects.toMatchObject({
      code: 'TRANSMISSION_FAILED',
    });
    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(messenger.handlers.size).toBe(0);
    expect(() => remote.ping()).toThrow(
      expect.objectContaining({ code: 'CONNECTION_DESTROYED' }),
    );
  });

  it('rejects with CONNECTION_TIMEOUT when the first handshake takes too long', async () => {
    vi.useFakeTimers();
    const messenger = new MockMessenger();
    const connection = connect({ messenger, timeout: 50 });
    const rejection = expect(connection.promise).rejects.toMatchObject({
      code: 'CONNECTION_TIMEOUT',
      message: 'Connection timed out after 50ms',
    });

    await vi.advanceTimersByTimeAsync(50);
    await rejection;
    expect(messenger.handlers.size).toBe(0);
  });

  it('cancels the connection timeout after the first handshake', async () => {
    vi.useFakeTimers();
    const messenger = new MockMessenger();
    const connection = connect({
      messenger,
      channel: messageBase.channel,
      timeout: 50,
    });

    completeHandshake(messenger);
    await connection.promise;

    expect(vi.getTimerCount()).toBe(0);
    connection.destroy();
  });
});
