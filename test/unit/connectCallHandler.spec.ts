import { afterEach, describe, expect, it, vi } from 'vitest';
import connectCallHandler from '../../src/connectCallHandler.js';
import namespace from '../../src/namespace.js';
import type { Message } from '../../src/types.js';
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
