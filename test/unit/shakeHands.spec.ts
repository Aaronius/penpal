import { describe, expect, it } from 'vitest';
import { DEPRECATED_PENPAL_PARTICIPANT_ID } from '../../src/backwardCompatibility.js';
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

    const error = await shakeHands({
      messenger,
      methods: {},
      timeout: undefined,
      channel: undefined,
      log: undefined,
    }).catch((caughtError) => {
      return caughtError as PenpalError;
    });

    expect(error).toEqual(expect.any(PenpalError));
    expect(error).toMatchObject({
      name: 'PenpalError',
      code: 'TRANSMISSION_FAILED',
      message: 'postMessage failed',
    });
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
      participantId: DEPRECATED_PENPAL_PARTICIPANT_ID,
    });

    const error = await handshakePromise.catch((caughtError) => {
      return caughtError as PenpalError;
    });

    expect(error).toEqual(expect.any(PenpalError));
    expect(error).toMatchObject({
      name: 'PenpalError',
      code: 'TRANSMISSION_FAILED',
      message: 'ack1 failed',
    });
  });
});
