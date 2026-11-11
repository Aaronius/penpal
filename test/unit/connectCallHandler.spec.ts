import { afterEach, describe, expect, it, vi } from 'vitest';
import Reply from '../../src/Reply.js';
import connectCallHandler from '../../src/connectCallHandler.js';
import namespace from '../../src/namespace.js';
import { MockMessenger } from './mockMessenger.js';

describe('connectCallHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends serialized error reply when sending unclonable value throws DataCloneError', async () => {
    const messenger = new MockMessenger();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      // Suppress the expected error in test output.
    });
    let sendCount = 0;

    messenger.sendMessageImpl = () => {
      sendCount += 1;

      if (sendCount === 1) {
        const error = new Error('Cannot clone value');
        error.name = 'DataCloneError';
        throw error;
      }
    };

    const { handleMessage, destroy } = connectCallHandler(
      messenger,
      {
        getUnclonableValue() {
          return globalThis;
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
      methodPath: ['getUnclonableValue'],
      args: [],
    });

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'DataCloneError',
          message: 'Cannot clone value',
        }),
      );
    });
    expect(sendCount).toBe(2);
    expect(messenger.sentMessages[1]).toMatchObject({
      type: 'REPLY',
      callId: '1',
      isError: true,
      isSerializedErrorInstance: true,
    });

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

  it('reports non-DataCloneError send failures', async () => {
    const messenger = new MockMessenger();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      // Suppress the expected error in test output.
    });

    messenger.sendMessageImpl = () => {
      throw new Error('send failed');
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
        expect.objectContaining({ message: 'send failed' }),
      );
    });

    destroy();
  });
});
