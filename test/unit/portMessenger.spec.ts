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

describe('PortMessenger', () => {
  it('forwards only validated messages to handlers', async ({
    onTestFinished,
  }) => {
    const { port1, port2 } = new MessageChannel();

    const messenger = new PortMessenger({
      port: port1,
    });
    onTestFinished(() => {
      messenger.destroy();
      port1.close();
      port2.close();
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

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalledTimes(1);
    });
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SYN', participantId: 'participant' }),
    );
  });

  it('ignores queued and later messages after destroy while leaving the port usable', async ({
    onTestFinished,
  }) => {
    const { port1, port2 } = new MessageChannel();

    const messenger = new PortMessenger({
      port: port1,
    });
    onTestFinished(() => {
      messenger.destroy();
      port1.close();
      port2.close();
    });

    const callback = vi.fn();
    const validate = vi.fn();
    const applicationListener = vi.fn();
    const peerListener = vi.fn();
    port1.addEventListener('message', ({ data }) => applicationListener(data));
    port2.addEventListener('message', ({ data }) => peerListener(data));
    port2.start();

    messenger.initialize({
      validateReceivedMessage(data): data is Message {
        validate(data);
        return validateReceivedMessage(data);
      },
    });
    messenger.addMessageHandler(callback);

    messenger.sendMessage({
      namespace,
      channel: undefined,
      type: 'DESTROY',
    });

    await vi.waitFor(() => {
      expect(peerListener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'DESTROY', namespace }),
      );
    });

    const message = {
      namespace,
      channel: undefined,
      type: 'SYN',
      participantId: 'participant',
    };
    port2.postMessage(message);
    messenger.destroy();
    port2.postMessage(message);

    await vi.waitFor(() => {
      expect(applicationListener).toHaveBeenCalledTimes(2);
    });
    expect(validate).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });
});
