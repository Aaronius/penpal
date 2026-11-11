import type { Ack1Message, Ack2Message, SynMessage } from './types.js';
import generateId from './generateId.js';
import namespace from './namespace.js';

export type HandshakeMessage = SynMessage | Ack1Message | Ack2Message;

type HandshakeOptions = {
  channel: string | undefined;
  sendMessage: (message: HandshakeMessage) => boolean;
  onNewParticipant: () => void;
  onComplete: () => void;
};

type Handshake = {
  start: () => void;
  handleMessage: (message: HandshakeMessage) => void;
};

/**
 * Attempts to establish communication with the remote via a handshake protocol.
 * The handshake protocol fulfills a few requirements:
 *
 * 1. One participant in the handshake may not be available when the other
 *    participant starts the handshake. For example, a document inside an iframe
 *    may not be loaded when the parent window starts a handshake.
 * 2. While #1 could be solved by having the consumer of Penpal specify which
 *    participant should initiate the handshake, we'd rather avoid this
 *    unnecessary cognitive load.
 * 3. While #1 could be solved by having the consumer of Penpal specify which
 *    participant is the "parent" or "child" and then having Penpal assume
 *    the child should initiate the handshake, we'd rather avoid parent-child
 *    terminology since Penpal can support communication between two
 *    participants where neither would be considered a parent nor child. It may
 *    also be too presumptive that the child should always initiate the
 *    handshake.
 * 4. For robustness, each participant must know that the other participant is
 *    receiving its messages for the handshake to be considered complete.
 * 5. The handshake should support a participant attempting to
 *    re-establish the connection. This can occur, for example, if an end user
 *    were to right-click within an iframe and click reload.
 * 6. The handshake should allow a Messenger to easily attach something to
 *    a handshake message from one participant to the other unidirectionally
 *    (rather than from both participants to each other).
 *    This is important when a participant needs to be in charge of, for
 *    example, creating a MessageChannel and sending one MessagePort from the
 *    MessagePort pair to the other participant. If both participants attempted
 *    to do this it could lead to confusion.
 * 7. The handshake ideally shouldn't require sending handshake messages on an
 *    interval (retrying until the other participant is ready to receive them).
 *    Intervals can increase compute resources if the interval is too short
 *    or increase latency if the interval is too long. While we could make this
 *    configurable, it's additional mental load for the consumer. Additionally,
 *    setInterval and setTimeout are not available within some contexts
 *    (like AudioWorklet), where a consumer may like to use Penpal.
 *
 * To accomplish these requirements, the handshake protocol is as follows:
 * 1. Each participant generates a random participant ID.
 * 2. As soon as possible, each participant sends a SYN message containing its
 *    participant ID to the other participant.
 * 3. When the SYN messages were sent, one of the participants may not have
 *    been ready to receive the SYN message from the other. At least one
 *    of the participants was ready, however, and should have received a SYN
 *    message from the other participant. Each participant that did receive
 *    a SYN message knows for sure that the other participant is now ready
 *    to receive a SYN message, so it will send another SYN message in case
 *    the other participant did not receive the first SYN message. This
 *    ultimately results in each participant sending two SYN messages.
 * 4. Each participant now should have received at least one SYN message from
 *    the other participant. Each participant compares their own ID with the
 *    other participant's ID. Whichever participant has the higher ID
 *    (using a simple string comparison) is considered the handshake leader
 *    and will send an ACK1 message to the other participant.
 * 5. At this point, the handshake leader does not know whether the other
 *    participant is actually receiving messages. The participant receiving
 *    the ACK1 message will respond with an ACK2, informing the handshake
 *    leader that it is indeed receiving messages.
 * 6. At this point, both participants know the other is receiving messages
 *    and the handshake is complete.
 */
const shakeHands = ({
  channel,
  sendMessage,
  onNewParticipant,
  onComplete,
}: HandshakeOptions): Handshake => {
  const participantId = generateId();
  let remoteParticipantId: string | undefined;

  const sendSyn = () => {
    return sendMessage({ namespace, channel, type: 'SYN', participantId });
  };

  const handleSyn = (message: SynMessage) => {
    // Each side can send two SYNs during one handshake. Ignore the repeated
    // ID so the second SYN from the same participant can't restart it.
    if (message.participantId === remoteParticipantId) {
      return;
    }

    remoteParticipantId = message.participantId;
    onNewParticipant();

    if (sendSyn() && participantId > message.participantId) {
      sendMessage({ namespace, channel, type: 'ACK1' });
    }
  };

  const handleMessage = (message: HandshakeMessage) => {
    switch (message.type) {
      case 'SYN':
        handleSyn(message);
        break;
      case 'ACK1':
        // Sending ACK2 lets WindowMessenger and WebWorkerMessenger transfer
        // the port for method calls and replies. Finish the handshake only
        // after the send succeeds.
        if (sendMessage({ namespace, channel, type: 'ACK2' })) {
          onComplete();
        }
        break;
      case 'ACK2':
        onComplete();
        break;
    }
  };

  return { start: sendSyn, handleMessage };
};

export default shakeHands;
