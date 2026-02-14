import { describe, expect, it } from 'vitest';
import shakeHands from '../../src/shakeHands.js';
import namespace from '../../src/namespace.js';
import PenpalError from '../../src/PenpalError.js';
import { MockMessenger } from './mockMessenger.js';

describe('shakeHands', () => {
  it('rejects with TRANSMISSION_FAILED when sending SYN fails', async () => {
    const messenger = new MockMessenger();
    messenger.sendMessageImpl = () => {
      throw new Error('postMessage failed');
    };

    await expect(
      shakeHands({
        messenger,
        methods: {},
        timeout: undefined,
        channel: undefined,
        log: undefined,
      })
    ).rejects.toMatchObject({
      code: 'TRANSMISSION_FAILED',
      message: 'postMessage failed',
    } as PenpalError);
  });

  it('rejects with TRANSMISSION_FAILED when sending ACK1 fails', async () => {
    const messenger = new MockMessenger();
    messenger.sendMessageImpl = (message) => {
      if (message.type === 'ACK1') {
        throw new Error('ack1 failed');
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
      type: 'SYN',
      participantId: 'deprecated-penpal',
    });

    await expect(handshakePromise).rejects.toMatchObject({
      code: 'TRANSMISSION_FAILED',
      message: 'ack1 failed',
    } as PenpalError);
  });
});
