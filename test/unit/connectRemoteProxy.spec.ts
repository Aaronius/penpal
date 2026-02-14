import { describe, expect, it, vi } from 'vitest';
import CallOptions from '../../src/CallOptions.js';
import connectRemoteProxy from '../../src/connectRemoteProxy.js';
import namespace from '../../src/namespace.js';
import type { CallMessage } from '../../src/types.js';
import { MockMessenger } from './mockMessenger.js';

type TestRemoteProxy = {
  multiply: (num1: number, num2: number) => Promise<number>;
  sendBuffer: (options: CallOptions) => Promise<string>;
  neverResolve: (options?: CallOptions) => Promise<unknown>;
  explode: () => Promise<unknown>;
};

const getLastCallMessage = (messenger: MockMessenger): CallMessage => {
  const message = messenger.sentMessages[messenger.sentMessages.length - 1];

  if (!message || message.type !== 'CALL') {
    throw new Error('Expected last sent message to be CALL');
  }

  return message;
};

describe('connectRemoteProxy', () => {
  it('sends CALL and resolves when receiving REPLY', async () => {
    const messenger = new MockMessenger();

    const { remoteProxy, destroy } = connectRemoteProxy(
      messenger,
      undefined,
      undefined
    );
    const proxy = (remoteProxy as unknown) as TestRemoteProxy;

    const resultPromise = proxy.multiply(2, 3);

    const callMessage = getLastCallMessage(messenger);
    expect(callMessage).toMatchObject({
      type: 'CALL',
      methodPath: ['multiply'],
      args: [2, 3],
    });

    await messenger.emit({
      namespace,
      channel: undefined,
      type: 'REPLY',
      callId: callMessage.id,
      value: 6,
    });

    await expect(resultPromise).resolves.toBe(6);
    destroy();
  });

  it('forwards transferables from CallOptions to messenger.sendMessage', async () => {
    const messenger = new MockMessenger();
    let capturedTransferables: Transferable[] | undefined;

    messenger.sendMessageImpl = (_message, transferables) => {
      capturedTransferables = transferables;
    };

    const { remoteProxy, destroy } = connectRemoteProxy(
      messenger,
      undefined,
      undefined
    );
    const proxy = (remoteProxy as unknown) as TestRemoteProxy;

    const buffer = new ArrayBuffer(8);

    const resultPromise = proxy.sendBuffer(
      new CallOptions({ transferables: [buffer] })
    );

    const callMessage = getLastCallMessage(messenger);
    expect(capturedTransferables).toEqual([buffer]);

    await messenger.emit({
      namespace,
      channel: undefined,
      type: 'REPLY',
      callId: callMessage.id,
      value: 'ok',
    });

    await expect(resultPromise).resolves.toBe('ok');
    destroy();
  });

  it('rejects with METHOD_CALL_TIMEOUT when method call timeout is exceeded', async () => {
    const messenger = new MockMessenger();

    const { remoteProxy, destroy } = connectRemoteProxy(
      messenger,
      undefined,
      undefined
    );
    const proxy = (remoteProxy as unknown) as TestRemoteProxy;

    const resultPromise = proxy.neverResolve(new CallOptions({ timeout: 0 }));

    await expect(resultPromise).rejects.toMatchObject({
      code: 'METHOD_CALL_TIMEOUT',
    });

    destroy();
  });

  it('rejects with deserialized Error when REPLY includes serialized error', async () => {
    const messenger = new MockMessenger();

    const { remoteProxy, destroy } = connectRemoteProxy(
      messenger,
      undefined,
      undefined
    );
    const proxy = (remoteProxy as unknown) as TestRemoteProxy;

    const resultPromise = proxy.explode();

    const callMessage = getLastCallMessage(messenger);

    await messenger.emit({
      namespace,
      channel: undefined,
      type: 'REPLY',
      callId: callMessage.id,
      isError: true,
      isSerializedErrorInstance: true,
      value: {
        name: 'TypeError',
        message: 'boom',
      },
    });

    await expect(resultPromise).rejects.toMatchObject({
      name: 'TypeError',
      message: 'boom',
    });

    destroy();
  });

  it('rejects pending method calls when proxy is destroyed', async () => {
    const messenger = new MockMessenger();

    const { remoteProxy, destroy } = connectRemoteProxy(
      messenger,
      undefined,
      undefined
    );
    const proxy = (remoteProxy as unknown) as TestRemoteProxy;

    const resultPromise = proxy.neverResolve();

    destroy();

    await expect(resultPromise).rejects.toMatchObject({
      code: 'CONNECTION_DESTROYED',
    });
  });

  it('clears method call timeout after receiving REPLY', async () => {
    const messenger = new MockMessenger();
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const { remoteProxy, destroy } = connectRemoteProxy(
      messenger,
      undefined,
      undefined
    );
    const proxy = (remoteProxy as unknown) as TestRemoteProxy;

    const resultPromise = proxy.neverResolve(
      new CallOptions({ timeout: 1000 })
    );
    const callMessage = getLastCallMessage(messenger);

    await messenger.emit({
      namespace,
      channel: undefined,
      type: 'REPLY',
      callId: callMessage.id,
      value: 'done',
    });

    await expect(resultPromise).resolves.toBe('done');
    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
    destroy();
  });
});
