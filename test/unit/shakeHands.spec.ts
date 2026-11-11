import { describe, expect, it, vi } from 'vitest';
import namespace from '../../src/namespace.js';
import shakeHands from '../../src/shakeHands.js';

vi.mock('../../src/generateId.js', () => ({
  default: () => 'local',
}));

const messageBase = { namespace, channel: 'test-channel' };

const createHandshake = () => {
  const sendMessage = vi.fn(() => true);
  const onNewParticipant = vi.fn();
  const onComplete = vi.fn();
  const handshake = shakeHands({
    channel: messageBase.channel,
    sendMessage,
    onNewParticipant,
    onComplete,
  });

  return { handshake, sendMessage, onNewParticipant, onComplete };
};

describe('shakeHands', () => {
  it('sends SYN on start and after hearing from a new participant', () => {
    const { handshake, sendMessage, onNewParticipant } = createHandshake();
    const syn = { ...messageBase, type: 'SYN', participantId: 'local' };

    expect(sendMessage).not.toHaveBeenCalled();
    handshake.start();
    expect(sendMessage).toHaveBeenNthCalledWith(1, syn);

    handshake.handleMessage({
      ...messageBase,
      type: 'SYN',
      participantId: 'remote',
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, syn);
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(onNewParticipant).toHaveBeenCalledTimes(1);
  });

  it('ignores a repeated SYN and responds when the participant ID changes', () => {
    const { handshake, sendMessage, onNewParticipant } = createHandshake();
    const syn = {
      ...messageBase,
      type: 'SYN',
      participantId: 'remote',
    } as const;

    handshake.handleMessage(syn);
    handshake.handleMessage(syn);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(onNewParticipant).toHaveBeenCalledTimes(1);

    handshake.handleMessage({ ...syn, participantId: 'reloaded' });
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(onNewParticipant).toHaveBeenCalledTimes(2);
  });

  it('sends ACK1 as the leader and completes on ACK2', () => {
    const { handshake, sendMessage, onComplete } = createHandshake();

    handshake.handleMessage({
      ...messageBase,
      type: 'SYN',
      participantId: 'earlier',
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, {
      ...messageBase,
      type: 'ACK1',
    });
    expect(onComplete).not.toHaveBeenCalled();

    handshake.handleMessage({ ...messageBase, type: 'ACK2' });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('sends ACK2 before reporting completion on the other side', () => {
    const { handshake, sendMessage, onComplete } = createHandshake();

    handshake.handleMessage({ ...messageBase, type: 'ACK1' });

    expect(sendMessage).toHaveBeenCalledWith({ ...messageBase, type: 'ACK2' });
    expect(sendMessage).toHaveBeenCalledBefore(onComplete);
  });

  it('does not complete when ACK2 cannot be sent', () => {
    const { handshake, sendMessage, onComplete } = createHandshake();
    sendMessage.mockReturnValue(false);

    handshake.handleMessage({ ...messageBase, type: 'ACK1' });

    expect(sendMessage).toHaveBeenCalledWith({ ...messageBase, type: 'ACK2' });
    expect(onComplete).not.toHaveBeenCalled();
  });
});
