import { describe, expect, it } from 'vitest';
import connectCallHandler from '../../src/connectCallHandler.js';
import namespace from '../../src/namespace.js';
import type { Message } from '../../src/types.js';
import { MockMessenger } from './mockMessenger.js';

describe('connectCallHandler', () => {
  it('sends serialized error reply when sending unclonable value throws DataCloneError', async () => {
    const messenger = new MockMessenger();
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
      undefined
    );

    await messenger.emit({
      namespace,
      channel: undefined,
      type: 'CALL',
      id: '1',
      methodPath: ['getUnclonableValue'],
      args: [],
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

    expect(messenger.sentMessages).toHaveLength(1);
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
      undefined
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
