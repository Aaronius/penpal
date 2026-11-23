import { afterEach, describe, expect, it, vi } from 'vitest';
import type Messenger from '../../src/messengers/Messenger.js';
import CallOptions from '../../src/CallOptions.js';
import PenpalError from '../../src/PenpalError.js';
import namespace from '../../src/namespace.js';
import connect from '../../src/connect.js';
import PortMessenger from '../../src/messengers/PortMessenger.js';
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
    vi.restoreAllMocks();
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
    expect(messenger.initializeOptions).toBeUndefined();
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
    expect(messenger.initializeOptions).toBeUndefined();
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
    expect(messenger.initializeOptions).toBeUndefined();
    expect(messenger.sentMessages).toHaveLength(numberOfMessages);
  });

  it('rejects the pending handshake when the remote sends SYN then DESTROY', async () => {
    const messenger = new MockMessenger();
    const connection = connect({ messenger, channel: messageBase.channel });

    messenger.emit(remoteSyn);
    messenger.emit({ ...messageBase, type: 'DESTROY' });

    await expect(connection.promise).rejects.toMatchObject({
      code: 'CONNECTION_DESTROYED',
    });
    expect(messenger.sentMessages).toEqual([
      expect.objectContaining({ type: 'SYN' }),
      expect.objectContaining({ type: 'SYN' }),
    ]);
    expect(messenger.initializeOptions).toBeUndefined();
  });

  it('ignores an old DESTROY before the replacement peer sends SYN', async () => {
    const messenger = new MockMessenger();
    const connection = connect({ messenger, channel: messageBase.channel });

    messenger.emit({ ...messageBase, type: 'DESTROY' });
    completeHandshake(messenger);

    await expect(connection.promise).resolves.toBeDefined();
    connection.destroy();
  });

  it('reconnects immediately on the same ports and channel', async ({
    onTestFinished,
  }) => {
    const { port1, port2 } = new MessageChannel();
    const connections: ReturnType<typeof connect>[] = [];
    onTestFinished(() => {
      connections.forEach((connection) => connection.destroy());
      port1.close();
      port2.close();
    });

    for (let generation = 0; generation < 3; generation++) {
      const left = connect<{ generation(): number }>({
        messenger: new PortMessenger({ port: port1 }),
        channel: messageBase.channel,
        timeout: 1000,
        methods: { generation: () => generation },
      });
      const right = connect<{ generation(): number }>({
        messenger: new PortMessenger({ port: port2 }),
        channel: messageBase.channel,
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

  it('skips the handshake if the messenger disconnects during initialization', async () => {
    const messenger = new MockMessenger();
    vi.useFakeTimers();
    const initialize = messenger.initialize;
    messenger.initialize = (options) => {
      initialize(options);
      options.onDisconnect?.();
    };

    const connection = connect({ messenger, timeout: 50 });

    await expect(connection.promise).rejects.toMatchObject({
      code: 'CONNECTION_DESTROYED',
    });
    expect(messenger.initializeOptions).toBeUndefined();
    expect(messenger.sentMessages).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('can finish the handshake during initialization and cancel the timeout', async () => {
    vi.useFakeTimers();
    const messenger = new MockMessenger();
    const initialize = messenger.initialize;
    messenger.initialize = (options) => {
      initialize(options);
      completeHandshake(messenger);
    };

    const connection = connect({
      messenger,
      channel: messageBase.channel,
      timeout: 50,
    });

    await expect(connection.promise).resolves.toBeDefined();
    expect(messenger.sentMessages.map(({ type }) => type)).toContain('ACK2');
    expect(vi.getTimerCount()).toBe(0);
    connection.destroy();
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
    expect(messenger.initializeOptions).toBeUndefined();
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
    expect(messenger.initializeOptions).toBeUndefined();
  });

  it.each(['SYN', 'ACK2'])(
    'tears down the connection if sending %s fails',
    async (type) => {
      const messenger = new MockMessenger();
      const sendError = new Error('send failed');
      messenger.sendMessageImpl = (message) => {
        if (message.type === type) {
          throw sendError;
        }
      };
      const connection = connect({ messenger, channel: messageBase.channel });

      if (type === 'ACK2') {
        completeHandshake(messenger);
      }

      await expect(connection.promise).rejects.toBeInstanceOf(PenpalError);
      await expect(connection.promise).rejects.toMatchObject({
        code: 'TRANSMISSION_FAILED',
        message: sendError.message,
        cause: sendError,
      });
      expect(messenger.sentMessages.at(-1)).toEqual({
        ...messageBase,
        type: 'DESTROY',
      });
      expect(messenger.initializeOptions).toBeUndefined();
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
    expect(messenger.initializeOptions).toBeUndefined();
    await expect(remote.ping()).rejects.toMatchObject({
      code: 'CONNECTION_DESTROYED',
    });
  });

  it('wraps the initialization error even when messenger cleanup also throws', async () => {
    const messenger = new MockMessenger();
    const initializationError = new Error('Could not open the transport');
    const cleanupError = new Error('Could not remove the listener');
    vi.spyOn(messenger, 'initialize').mockImplementation(() => {
      throw initializationError;
    });
    vi.spyOn(messenger, 'destroy').mockImplementation(() => {
      throw cleanupError;
    });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const connection = connect({ messenger });

    await expect(connection.promise).rejects.toBeInstanceOf(PenpalError);
    await expect(connection.promise).rejects.toMatchObject({
      code: 'CONNECTION_INITIALIZATION_FAILED',
      message: initializationError.message,
      cause: initializationError,
    });
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), cleanupError);
  });

  it('wraps a PenpalError thrown by messenger initialization', async () => {
    const messenger = new MockMessenger();
    const initializationError = new PenpalError(
      'INVALID_ARGUMENT',
      'Cannot initialize this messenger',
    );
    vi.spyOn(messenger, 'initialize').mockImplementation(() => {
      throw initializationError;
    });

    const connection = connect({ messenger });

    await expect(connection.promise).rejects.toBeInstanceOf(PenpalError);
    await expect(connection.promise).rejects.toMatchObject({
      code: 'CONNECTION_INITIALIZATION_FAILED',
      message: initializationError.message,
      cause: initializationError,
    });
  });

  it('rejects pending calls when messenger cleanup throws', async () => {
    const messenger = new MockMessenger();
    const cleanupError = new Error('Could not remove the listener');
    vi.spyOn(messenger, 'destroy').mockImplementation(() => {
      throw cleanupError;
    });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const connection = connect<{ ping(): string }>({
      messenger,
      channel: messageBase.channel,
    });
    completeHandshake(messenger);
    const remote = await connection.promise;
    const pending = remote.ping();

    connection.destroy();

    await expect(pending).rejects.toMatchObject({
      code: 'CONNECTION_DESTROYED',
    });
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), cleanupError);
  });

  it('completes the handshake and settles a call when the logger throws', async () => {
    const messenger = new MockMessenger();
    const logError = new Error('Logger unavailable');
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const log = vi.fn(() => {
      throw logError;
    });
    const connection = connect<{ ping(): string }>({
      messenger,
      channel: messageBase.channel,
      log,
    });
    completeHandshake(messenger);
    const remote = await connection.promise;
    const pending = remote.ping(new CallOptions({ timeout: 1000 }));
    const call = messenger.sentMessages.at(-1);
    if (call?.type !== 'CALL') {
      throw new Error('Expected a CALL message');
    }
    const reply = {
      ...messageBase,
      type: 'REPLY',
      callId: call.id,
      value: 'pong',
    };

    messenger.emit(reply);

    await expect(pending).resolves.toBe('pong');
    expect(log).toHaveBeenCalledWith('Received ping() reply', reply);
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), logError);
    connection.destroy();
  });

  it('skips messenger cleanup when startup fails before initialization', async () => {
    const messenger = new MockMessenger();
    const initialize = vi.spyOn(messenger, 'initialize');
    const destroy = vi.spyOn(messenger, 'destroy').mockImplementation(() => {
      throw new Error('Cannot destroy an uninitialized messenger');
    });

    vi.stubGlobal('setTimeout', undefined);
    try {
      const connection = connect({ messenger, timeout: 50 });

      await expect(connection.promise).rejects.toMatchObject({
        code: 'INVALID_ARGUMENT',
        message: 'Timeouts are unavailable in this environment',
      });
      connection.destroy();

      expect(initialize).not.toHaveBeenCalled();
      expect(destroy).not.toHaveBeenCalled();
      expect(messenger.sentMessages).toHaveLength(0);
    } finally {
      vi.unstubAllGlobals();
    }
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
    expect(messenger.initializeOptions).toBeUndefined();
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
