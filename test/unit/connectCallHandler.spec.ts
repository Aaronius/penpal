import { afterEach, describe, expect, it, vi } from 'vitest';
import Reply from '../../src/Reply.js';
import connectCallHandler from '../../src/connectCallHandler.js';
import namespace from '../../src/namespace.js';
import { MockMessenger } from './mockMessenger.js';

describe('connectCallHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends a cloneable transmission error when a reply getter throws during cloning', async () => {
    const messenger = new MockMessenger();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      // Suppress the expected error in test output.
    });
    const cloneError = new Error('Reading the reply failed');
    const buffer = new ArrayBuffer(8);
    const send = vi.spyOn(messenger, 'sendMessage');
    messenger.sendMessageImpl = (message, transferables) => {
      structuredClone(message, { transfer: transferables ?? [] });
    };

    const { handleMessage, destroy } = connectCallHandler(
      messenger,
      {
        getData() {
          return new Reply(
            {
              get buffer() {
                throw cloneError;
              },
            },
            { transferables: [buffer] },
          );
        },
      },
      undefined,
      undefined,
    );

    handleMessage({
      namespace,
      channel: undefined,
      type: 'CALL',
      id: '1',
      methodPath: ['getData'],
      args: [],
    });

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(cloneError);
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'REPLY',
        callId: '1',
        isError: true,
        isSerializedErrorInstance: true,
        value: expect.objectContaining({ penpalCode: 'TRANSMISSION_FAILED' }),
      }),
    );
    expect(buffer.byteLength).toBe(8);

    destroy();
  });

  it('keeps the buffer attached when a Reply value rejects', async () => {
    const messenger = new MockMessenger();
    const buffer = new ArrayBuffer(8);

    messenger.sendMessageImpl = (message, transferables) => {
      structuredClone(message, { transfer: transferables ?? [] });
    };

    const { handleMessage, destroy } = connectCallHandler(
      messenger,
      {
        getData() {
          return new Reply(Promise.reject(new Error('Access denied')), {
            transferables: [buffer],
          });
        },
      },
      undefined,
      undefined,
    );

    try {
      handleMessage({
        namespace,
        channel: undefined,
        type: 'CALL',
        id: '1',
        methodPath: ['getData'],
        args: [],
      });

      await vi.waitFor(() => {
        expect(messenger.sentMessages).toHaveLength(1);
      });
      expect(messenger.sentMessages[0]).toMatchObject({
        type: 'REPLY',
        callId: '1',
        isError: true,
        value: { message: 'Access denied' },
      });
      expect(buffer.byteLength).toBe(8);
    } finally {
      destroy();
    }
  });

  it('replies with METHOD_NOT_FOUND when method path does not exist', async () => {
    const messenger = new MockMessenger();

    const { handleMessage, destroy } = connectCallHandler(
      messenger,
      {},
      undefined,
      undefined,
    );

    handleMessage({
      namespace,
      channel: undefined,
      type: 'CALL',
      id: '2',
      methodPath: ['missingMethod'],
      args: [],
    });

    await vi.waitFor(() => {
      expect(messenger.sentMessages).toHaveLength(1);
    });
    expect(messenger.sentMessages[0]).toMatchObject({
      type: 'REPLY',
      callId: '2',
      isError: true,
      isSerializedErrorInstance: true,
      value: {
        name: 'PenpalError',
        penpalCode: 'METHOD_NOT_FOUND',
      },
    });

    destroy();
  });

  it('reports a failed fallback without attempting another reply', async () => {
    const messenger = new MockMessenger();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      // Suppress the expected error in test output.
    });

    messenger.sendMessageImpl = () => {
      throw new Error(`Send ${messenger.sentMessages.length} failed`);
    };

    const { handleMessage, destroy } = connectCallHandler(
      messenger,
      {
        ping() {
          return 'pong';
        },
      },
      undefined,
      undefined,
    );

    handleMessage({
      namespace,
      channel: undefined,
      type: 'CALL',
      id: '3',
      methodPath: ['ping'],
      args: [],
    });

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Send 2 failed' }),
      );
    });
    expect(messenger.sentMessages).toHaveLength(2);

    destroy();
  });
});
