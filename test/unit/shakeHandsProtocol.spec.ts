import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import namespace from '../../src/namespace.js';
import PenpalError from '../../src/PenpalError.js';
import { MockMessenger } from './mockMessenger.js';

const callHandlerDestroyMock = vi.hoisted(() => vi.fn());
const remoteProxyDestroyMock = vi.hoisted(() => vi.fn());
const remoteProxyMock = vi.hoisted(() => ({
  multiply: vi.fn(),
}));

const connectCallHandlerMock = vi.hoisted(() => {
  return vi.fn(() => callHandlerDestroyMock);
});

const connectRemoteProxyMock = vi.hoisted(() => {
  return vi.fn(() => ({
    remoteProxy: remoteProxyMock,
    destroy: remoteProxyDestroyMock,
  }));
});

const generateIdMock = vi.hoisted(() => vi.fn(() => 'local-participant-id'));

vi.mock('../../src/connectCallHandler.js', () => ({
  default: connectCallHandlerMock,
}));

vi.mock('../../src/connectRemoteProxy.js', () => ({
  default: connectRemoteProxyMock,
}));

vi.mock('../../src/generateId.js', () => ({
  default: generateIdMock,
}));

import shakeHands from '../../src/shakeHands.js';

describe('shakeHands protocol behavior', () => {
  beforeEach(() => {
    callHandlerDestroyMock.mockReset();
    remoteProxyDestroyMock.mockReset();
    connectCallHandlerMock.mockClear();
    connectRemoteProxyMock.mockClear();
    generateIdMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('completes handshake on ACK1 and wires call handler + proxy once', async () => {
    const messenger = new MockMessenger();
    const methods = {
      ping() {
        return 'pong';
      },
    };

    const handshakePromise = shakeHands({
      messenger,
      methods,
      timeout: undefined,
      channel: 'test-channel',
      log: undefined,
    });

    expect(messenger.sentMessages[0]).toMatchObject({
      namespace,
      channel: 'test-channel',
      type: 'SYN',
      participantId: 'local-participant-id',
    });

    await messenger.emit({
      namespace,
      channel: 'test-channel',
      type: 'ACK1',
      methodPaths: [['remote', 'multiply']],
    });

    const result = await handshakePromise;

    expect(messenger.sentMessages).toContainEqual({
      namespace,
      channel: 'test-channel',
      type: 'ACK2',
    });
    expect(connectCallHandlerMock).toHaveBeenCalledTimes(1);
    expect(connectCallHandlerMock).toHaveBeenCalledWith(
      messenger,
      methods,
      'test-channel',
      undefined
    );
    expect(connectRemoteProxyMock).toHaveBeenCalledTimes(1);
    expect(connectRemoteProxyMock).toHaveBeenCalledWith(
      messenger,
      'test-channel',
      undefined
    );
    expect(result.remoteProxy).toBe(remoteProxyMock);

    result.destroy();

    expect(callHandlerDestroyMock).toHaveBeenCalledTimes(1);
    expect(remoteProxyDestroyMock).toHaveBeenCalledTimes(1);
    expect(messenger.handlers.size).toBe(0);
  });

  it('keeps handshake completion idempotent when ACK2 is received multiple times', async () => {
    const messenger = new MockMessenger();

    const handshakePromise = shakeHands({
      messenger,
      methods: {},
      timeout: undefined,
      channel: undefined,
      log: undefined,
    });

    await messenger.emit({
      namespace,
      channel: undefined,
      type: 'ACK2',
    });

    const result = await handshakePromise;

    await messenger.emit({
      namespace,
      channel: undefined,
      type: 'ACK2',
    });

    expect(connectCallHandlerMock).toHaveBeenCalledTimes(1);
    expect(connectRemoteProxyMock).toHaveBeenCalledTimes(1);

    result.destroy();
  });

  it('rejects with TRANSMISSION_FAILED when sending ACK2 fails', async () => {
    const messenger = new MockMessenger();

    messenger.sendMessageImpl = (message) => {
      if (message.type === 'ACK2') {
        throw new Error('ack2 failed');
      }
    };

    const handshakePromise = shakeHands({
      messenger,
      methods: {},
      timeout: undefined,
      channel: undefined,
      log: undefined,
    });

    await messenger.emit({
      namespace,
      channel: undefined,
      type: 'ACK1',
      methodPaths: [],
    });

    const error = await handshakePromise.catch((caughtError) => {
      return caughtError as PenpalError;
    });

    expect(error).toEqual(expect.any(PenpalError));
    expect(error).toMatchObject({
      name: 'PenpalError',
      code: 'TRANSMISSION_FAILED',
      message: 'ack2 failed',
    });

    expect(connectCallHandlerMock).not.toHaveBeenCalled();
    expect(connectRemoteProxyMock).not.toHaveBeenCalled();
  });

  it('rejects with CONNECTION_TIMEOUT when handshake does not complete in time', async () => {
    vi.useFakeTimers();

    const messenger = new MockMessenger();

    const handshakePromise = shakeHands({
      messenger,
      methods: {},
      timeout: 50,
      channel: undefined,
      log: undefined,
    });

    const caughtErrorPromise = handshakePromise.catch((caughtError) => {
      return caughtError as PenpalError;
    });

    await vi.advanceTimersByTimeAsync(50);

    await expect(caughtErrorPromise).resolves.toEqual(
      expect.objectContaining({
        name: 'PenpalError',
        code: 'CONNECTION_TIMEOUT',
        message: 'Connection timed out after 50ms',
      })
    );

    await expect(caughtErrorPromise).resolves.toMatchObject({
      code: 'CONNECTION_TIMEOUT',
      message: 'Connection timed out after 50ms',
    });
  });
});
