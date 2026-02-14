import { describe, expect, it, vi } from 'vitest';
import PortMessenger from '../../src/messengers/PortMessenger.js';
import namespace from '../../src/namespace.js';
import type { Message } from '../../src/types.js';

const validateReceivedMessage = (data: unknown): data is Message => {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Message).namespace === namespace
  );
};

const waitForTick = async () => {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
};

describe('PortMessenger', () => {
  it('forwards only validated messages to handlers', async () => {
    const { port1, port2 } = new MessageChannel();

    const messenger = new PortMessenger({
      port: port1,
    });

    const callback = vi.fn();

    messenger.initialize({
      validateReceivedMessage,
    });
    messenger.addMessageHandler(callback);

    port2.postMessage({
      random: 'payload',
    });

    port2.postMessage({
      namespace,
      channel: undefined,
      type: 'SYN',
      participantId: 'participant',
    });

    await waitForTick();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toMatchObject({
      type: 'SYN',
      participantId: 'participant',
    });

    messenger.destroy();
  });

  it('stops forwarding incoming messages after destroy and can send messages', async () => {
    const { port1, port2 } = new MessageChannel();

    const messenger = new PortMessenger({
      port: port1,
    });

    const callback = vi.fn();

    messenger.initialize({
      validateReceivedMessage,
    });
    messenger.addMessageHandler(callback);

    const sentMessagePromise = new Promise<Message>((resolve) => {
      port2.addEventListener('message', ({ data }) => {
        resolve(data as Message);
      });
      port2.start();
    });

    messenger.sendMessage({
      namespace,
      channel: undefined,
      type: 'DESTROY',
    });

    await expect(sentMessagePromise).resolves.toMatchObject({
      type: 'DESTROY',
      namespace,
    });

    messenger.destroy();

    port2.postMessage({
      namespace,
      channel: undefined,
      type: 'SYN',
      participantId: 'participant',
    });

    await waitForTick();

    expect(callback).not.toHaveBeenCalled();
  });
});
