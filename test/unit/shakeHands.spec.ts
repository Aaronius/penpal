import { describe, expect, it } from 'vitest';
import shakeHands from '../../src/shakeHands.js';
import PenpalError from '../../src/PenpalError.js';
import { MockMessenger } from './mockMessenger.js';

describe('shakeHands', () => {
  it('rejects with TRANSMISSION_FAILED when sending SYN fails', async () => {
    const messenger = new MockMessenger();
    messenger.sendMessageImpl = () => {
      throw new Error('postMessage failed');
    };

    const handshake = shakeHands({
      messenger,
      methods: {},
      timeout: undefined,
      channel: undefined,
      log: undefined,
    });

    const error = await handshake.promise.catch((caughtError) => {
      return caughtError as PenpalError;
    });

    expect(error).toEqual(expect.any(PenpalError));
    expect(error).toMatchObject({
      name: 'PenpalError',
      code: 'TRANSMISSION_FAILED',
      message: 'postMessage failed',
    });
  });
});
