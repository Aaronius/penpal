import { afterEach, describe, expect, it, vi } from 'vitest';
import connectCallHandler from '../../src/connectCallHandler.js';
import namespace from '../../src/namespace.js';
import type { Message } from '../../src/types.js';
import { MockMessenger } from './mockMessenger.js';
import Reply from '../../src/Reply.js';

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

    const dispose = connectCallHandler(
      messenger,
      {
        getUnclonableValue() {
          return globalThis;
        },
      },
      undefined,
      undefined,
    );

    await messenger.emit({
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

    dispose();
  });

  it('adapts an async iterable iterator and transfers the created stream', async () => {
    const messenger = new MockMessenger();
    let sentTransferables: Transferable[] | undefined;
    messenger.sendMessageImpl = (_message, transferables) => {
      sentTransferables = transferables;
    };
    const dispose = connectCallHandler(
      messenger,
      {
        async *search() {
          yield 'a';
          yield 'b';
        },
      },
      undefined,
      undefined,
    );

    await messenger.emit({
      namespace,
      channel: undefined,
      type: 'CALL',
      id: 'stream-1',
      methodPath: ['search'],
      args: [],
    });

    await vi.waitFor(() => {
      expect(messenger.sentMessages).toHaveLength(1);
    });
    const reply = messenger.sentMessages[0];
    expect(reply).toMatchObject({ type: 'REPLY', callId: 'stream-1' });
    expect(reply?.type === 'REPLY' && reply.value).toEqual(
      expect.any(ReadableStream),
    );
    expect(sentTransferables).toEqual([
      reply?.type === 'REPLY' ? reply.value : undefined,
    ]);

    dispose();
  });

  it('preserves Reply transferables when adapting its iterator value', async () => {
    const messenger = new MockMessenger();
    const buffer = new ArrayBuffer(8);
    let sentTransferables: Transferable[] | undefined;
    messenger.sendMessageImpl = (_message, transferables) => {
      sentTransferables = transferables;
    };
    const dispose = connectCallHandler(
      messenger,
      {
        getStream() {
          return new Reply(
            (async function* () {
              yield 'value';
            })(),
            { transferables: [buffer] },
          );
        },
      },
      undefined,
      undefined,
    );

    await messenger.emit({
      namespace,
      channel: undefined,
      type: 'CALL',
      id: 'stream-2',
      methodPath: ['getStream'],
      args: [],
    });

    await vi.waitFor(() => {
      expect(messenger.sentMessages).toHaveLength(1);
    });
    const reply = messenger.sentMessages[0];
    expect(sentTransferables).toEqual([
      buffer,
      reply?.type === 'REPLY' ? reply.value : undefined,
    ]);

    dispose();
  });

  it('leaves an explicitly transferred ReadableStream unchanged', async () => {
    const messenger = new MockMessenger();
    const stream = new ReadableStream();
    let sentTransferables: Transferable[] | undefined;
    messenger.sendMessageImpl = (_message, transferables) => {
      sentTransferables = transferables;
    };
    const dispose = connectCallHandler(
      messenger,
      {
        getStream() {
          return new Reply(stream, { transferables: [stream] });
        },
      },
      undefined,
      undefined,
    );

    await messenger.emit({
      namespace,
      channel: undefined,
      type: 'CALL',
      id: 'stream-3',
      methodPath: ['getStream'],
      args: [],
    });

    await vi.waitFor(() => {
      expect(messenger.sentMessages).toHaveLength(1);
    });
    expect(messenger.sentMessages[0]).toMatchObject({ value: stream });
    expect(sentTransferables).toEqual([stream]);

    dispose();
  });

  it('returns active iterators when the call handler is disposed', async () => {
    const messenger = new MockMessenger();
    const cleanedUp = Promise.withResolvers<void>();
    const dispose = connectCallHandler(
      messenger,
      {
        async *search() {
          try {
            while (true) {
              yield 'value';
            }
          } finally {
            cleanedUp.resolve();
          }
        },
      },
      undefined,
      undefined,
    );

    await messenger.emit({
      namespace,
      channel: undefined,
      type: 'CALL',
      id: 'stream-4',
      methodPath: ['search'],
      args: [],
    });
    await vi.waitFor(() => {
      expect(messenger.sentMessages).toHaveLength(1);
    });

    const reply = messenger.sentMessages[0];
    if (
      !reply ||
      reply.type !== 'REPLY' ||
      !(reply.value instanceof ReadableStream)
    ) {
      throw new Error('Expected a ReadableStream reply');
    }
    await reply.value.getReader().read();

    dispose();

    await cleanedUp.promise;
  });

  it('cleans up the iterator if ReadableStream is unavailable', async () => {
    const messenger = new MockMessenger();
    const returnMethod = vi.fn(() =>
      Promise.resolve({ done: true as const, value: undefined }),
    );
    const iterator: AsyncIterableIterator<string> = {
      [Symbol.asyncIterator]() {
        return this;
      },
      next() {
        return Promise.resolve({ done: false, value: 'value' });
      },
      return: returnMethod,
    };
    const dispose = connectCallHandler(
      messenger,
      {
        search() {
          return iterator;
        },
      },
      undefined,
      undefined,
    );

    vi.stubGlobal('ReadableStream', undefined);

    try {
      await messenger.emit({
        namespace,
        channel: undefined,
        type: 'CALL',
        id: 'stream-5',
        methodPath: ['search'],
        args: [],
      });

      await vi.waitFor(() => {
        expect(messenger.sentMessages).toHaveLength(1);
      });
      expect(messenger.sentMessages[0]).toMatchObject({
        type: 'REPLY',
        callId: 'stream-5',
        isError: true,
        value: {
          name: 'PenpalError',
          message:
            'AsyncIterableIterator return values require ReadableStream support',
          penpalCode: 'TRANSMISSION_FAILED',
        },
      });
      expect(returnMethod).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      dispose();
    }
  });

  it('replies with METHOD_NOT_FOUND when method path does not exist', async () => {
    const messenger = new MockMessenger();

    const dispose = connectCallHandler(messenger, {}, undefined, undefined);

    await messenger.emit({
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

    dispose();
  });

  it('reports non-DataCloneError send failures', async () => {
    const messenger = new MockMessenger();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      // Suppress the expected error in test output.
    });

    messenger.sendMessageImpl = () => {
      throw new Error('send failed');
    };

    const dispose = connectCallHandler(
      messenger,
      {
        ping() {
          return 'pong';
        },
      },
      undefined,
      undefined,
    );

    await messenger.emit({
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

    dispose();
  });

  it('ignores non-call messages', async () => {
    const messenger = new MockMessenger();
    const dispose = connectCallHandler(
      messenger,
      {
        ping() {
          return 'pong';
        },
      },
      undefined,
      undefined,
    );

    await messenger.emit({
      namespace,
      channel: undefined,
      type: 'ACK2',
    } as Message);

    expect(messenger.sentMessages).toHaveLength(0);
    dispose();
  });
});
